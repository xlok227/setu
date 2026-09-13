/**
 * Headless behavioral smoke test.
 * Boots the REAL server.js against an in-memory MongoDB (mongodb-memory-server),
 * drives the full API lifecycle, restarts the server, and asserts persistence.
 * Run: node scripts/smoke-test.js
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = 5050;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail !== undefined ? ` -> ${JSON.stringify(detail)}` : ''}`);
  }
}

function startServer(env) {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  child.output = () => output;
  return child;
}

async function waitReady(child, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early (code ${child.exitCode}):\n${child.output()}`);
    }
    try {
      const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return await res.text();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server not ready in ${timeoutMs}ms:\n${child.output()}`);
}

function stopServer(child) {
  return new Promise((resolve) => {
    child.on('exit', resolve);
    child.kill();
    setTimeout(resolve, 3000).unref?.();
  });
}

async function api(method, urlPath, { token, body } = {}) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, json };
}

(async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  console.log('Starting in-memory MongoDB (downloads binary on first run)...');
  const mongod = await MongoMemoryServer.create();
  const MONGO_URI = mongod.getUri('setu_works');
  console.log(`mongod up at ${MONGO_URI}`);

  const env = { PORT: String(PORT), MONGO_URI, JWT_SECRET: 'test-secret', JWT_EXPIRES_IN: '7d' };

  // ---------- PHASE 1: fresh boot ----------
  console.log('\n=== PHASE 1: fresh server boot ===');
  let server = startServer(env);
  const root = await waitReady(server);
  assert(root === 'Setu backend is running', 'GET / returns health message', root);

  // --- Auth guards ---
  const badLogin = await api('POST', '/api/auth/login', { body: { email: 'student@setu.dev', password: 'wrong' } });
  assert(badLogin.status === 400 && badLogin.json.message === 'Invalid credentials', 'wrong password rejected 400', badLogin);

  const noToken = await api('GET', '/api/assessment/me');
  assert(noToken.status === 401, 'protected route without token -> 401', noToken.status);
  const badToken = await api('GET', '/api/assessment/me', { token: 'garbage.token.here' });
  assert(badToken.status === 401, 'garbage token -> 401', badToken.status);

  const studentLogin = await api('POST', '/api/auth/login', { body: { email: 'student@setu.dev', password: 'password123' } });
  assert(studentLogin.status === 200 && studentLogin.json.user?.role === 'student', 'student demo login works', studentLogin.json?.user);
  const studentToken = studentLogin.json?.token;

  const industryLogin = await api('POST', '/api/auth/login', { body: { email: 'industry@setu.dev', password: 'password123' } });
  assert(industryLogin.status === 200 && industryLogin.json.user?.role === 'industry', 'industry demo login works', industryLogin.json?.user);
  const industryToken = industryLogin.json?.token;

  // --- Seeded profile + REAL user data in user_id ---
  const me = await api('GET', '/api/assessment/me', { token: studentToken });
  assert(me.status === 200 && Array.isArray(me.json?.skills) && me.json.skills.length === 7, 'seeded student profile has 7 skills', me.json?.skills?.length);
  assert(me.json?.user_id?.name === 'Student Demo' && me.json?.user_id?.email === 'student@setu.dev', 'profile user_id comes from real DB user (not hardcoded)', me.json?.user_id);

  // --- Matches on SEEDED profile: exact deterministic math ---
  // Frontend Intern: (3*78 + 3*82 + 2*74) / 8 = 628/8 = 78.5, coverage 3/3 = 1
  // Data & Insights: (3*68 + 3*71 + 2*88) / 8 = 593/8 = 74.13, coverage 1
  const matches1 = await api('GET', '/api/postings/matches', { token: studentToken });
  const m1 = matches1.json || [];
  assert(matches1.status === 200 && m1.length === 2, 'student sees 2 seeded open postings', m1.length);
  const fe1 = m1.find((x) => x.title === 'Frontend Intern');
  const di1 = m1.find((x) => x.title === 'Data & Insights Intern');
  assert(fe1 && fe1.match_score === 78.5 && fe1.coverage_ratio === 1 && fe1.final_score === 78.5, 'exact match math on seeded profile: Frontend = 78.5', fe1);
  assert(di1 && di1.match_score === 74.13 && di1.final_score === 74.13, 'exact match math on seeded profile: Data = 74.13', di1);
  assert(m1[0]?.title === 'Frontend Intern', 'Frontend Intern ranked first (78.5 > 74.13)', m1.map((x) => x.title));
  assert(typeof fe1?.posting_id === 'string' && fe1?.industry?.name === 'Industry Demo', 'match shape: posting_id string, industry populated', fe1?.industry);

  // --- Assessment saves: skill update + history snapshots ---
  const save1 = await api('POST', '/api/assessment/submit', { token: studentToken, body: { skills: [{ skill_name: 'React', proficiency: 50 }] } });
  assert(save1.status === 200 && save1.json?.profile?.skills?.[0]?.proficiency === 50, 'save #1 stores React=50', save1.json?.profile?.skills);
  assert(save1.json?.profile?.assessment_history?.length === 1 && save1.json.profile.assessment_history[0].skills_snapshot.length === 7, 'save #1 snapshots the previous 7-skill profile into history', save1.json?.profile?.assessment_history?.length);

  const save2 = await api('POST', '/api/assessment/submit', { token: studentToken, body: { skills: [{ skill_name: 'React', proficiency: 91 }] } });
  assert(save2.status === 200 && save2.json?.profile?.skills?.[0]?.proficiency === 91, 'save #2 stores React=91', save2.json?.profile?.skills);
  assert(save2.json?.profile?.assessment_history?.length === 2, 'save #2 pushes second snapshot (history length 2)', save2.json?.profile?.assessment_history?.length);
  assert(save2.json?.profile?.assessment_history?.[1]?.skills_snapshot?.[0]?.proficiency === 50, 'history[1] snapshot holds React=50 from previous state', save2.json?.profile?.assessment_history?.[1]?.skills_snapshot);

  // --- Matches respond to the SAVED profile (only React=91 now) ---
  const matches2 = await api('GET', '/api/postings/matches', { token: studentToken });
  const fe2 = (matches2.json || []).find((x) => x.title === 'Frontend Intern');
  const di2 = (matches2.json || []).find((x) => x.title === 'Data & Insights Intern');
  assert(fe2 && fe2.coverage_ratio === 0.33 && fe2.match_score === 34.13, 're-matched with saved skills: Frontend coverage 1/3, score 34.13', fe2);
  assert(di2 && di2.match_score === 0 && di2.final_score === 0, 'no-overlap posting scores 0', di2);
  assert((matches2.json || [])[0]?.title === 'Frontend Intern', 'Frontend Intern still ranked first', (matches2.json || []).map((x) => x.title));

  // --- New student signup -> auto profile, duplicate rejected ---
  const signup = await api('POST', '/api/auth/signup', { body: { name: 'Test Student', email: 'test.student@example.com', password: 'secret123', role: 'student' } });
  assert(signup.status === 201 && signup.json?.token && signup.json?.user?.role === 'student', 'new student signup -> 201 with token', signup.json?.user);
  const newStudentToken = signup.json?.token;
  const dupSignup = await api('POST', '/api/auth/signup', { body: { name: 'Test Student', email: 'test.student@example.com', password: 'secret123', role: 'student' } });
  assert(dupSignup.status === 400, 'duplicate email signup -> 400', dupSignup.status);
  const newMe = await api('GET', '/api/assessment/me', { token: newStudentToken });
  assert(newMe.status === 200 && Array.isArray(newMe.json?.skills) && newMe.json.skills.length === 0 && newMe.json?.user_id?.name === 'Test Student', 'signup auto-created empty profile with real user data', newMe.json);
  const persistSave = await api('POST', '/api/assessment/submit', { token: newStudentToken, body: { skills: [{ skill_name: 'PersistedSkill', proficiency: 87 }] } });
  assert(persistSave.status === 200, 'new student saves PersistedSkill=87', persistSave.status);

  // --- Industry: create posting + role guards ---
  const createByStudent = await api('POST', '/api/postings/create', { token: studentToken, body: { title: 'X', description: 'Y', required_skills: [{ skill_name: 'React', weight: 'high' }] } });
  assert(createByStudent.status === 403, 'student cannot create posting -> 403', createByStudent.status);
  const created = await api('POST', '/api/postings/create', {
    token: industryToken,
    body: { title: 'QA Automation Intern', description: 'Automated testing focus.', required_skills: [{ skill_name: 'JavaScript', weight: 'high' }] },
  });
  assert(created.status === 201 && created.json?.posting?._id && created.json.posting.status === 'open', 'industry creates posting -> 201 with _id', created.json?.posting);
  const mine = await api('GET', '/api/postings/mine', { token: industryToken });
  assert(mine.status === 200 && mine.json?.length === 3 && mine.json.some((p) => p.title === 'QA Automation Intern'), 'industry /mine lists 3 postings incl. new one', mine.json?.map((p) => p.title));
  const mineByStudent = await api('GET', '/api/postings/mine', { token: studentToken });
  assert(mineByStudent.status === 403, 'student cannot view /mine -> 403', mineByStudent.status);
  const matchesByIndustry = await api('GET', '/api/postings/matches', { token: industryToken });
  assert(matchesByIndustry.status === 403, 'industry cannot view /matches -> 403', matchesByIndustry.status);
  const allPostings = await api('GET', '/api/postings/all', { token: studentToken });
  assert(allPostings.status === 200 && allPostings.json?.length === 3, '/all shows 3 open postings', allPostings.json?.length);

  await stopServer(server);
  console.log('\nServer stopped. Restarting against the SAME database...');

  // ---------- PHASE 2: restart persistence ----------
  console.log('\n=== PHASE 2: restart -> persistence + no duplicate seed ===');
  server = startServer(env);
  await waitReady(server);

  const relogin = await api('POST', '/api/auth/login', { body: { email: 'test.student@example.com', password: 'secret123' } });
  assert(relogin.status === 200, 'PERSISTENCE: new signup still logs in after restart', relogin.status);
  const demoStillWorks = await api('POST', '/api/auth/login', { body: { email: 'student@setu.dev', password: 'password123' } });
  assert(demoStillWorks.status === 200, 'PERSISTENCE: demo users survive restart', demoStillWorks.status);

  const persistedProfile = await api('GET', '/api/assessment/me', { token: newStudentToken });
  assert(persistedProfile.status === 200 && persistedProfile.json?.skills?.[0]?.skill_name === 'PersistedSkill' && persistedProfile.json.skills[0].proficiency === 87, 'PERSISTENCE: assessment edit survives restart', persistedProfile.json?.skills);

  const persistedMine = await api('GET', '/api/postings/mine', { token: industryToken });
  assert(persistedMine.status === 200 && persistedMine.json?.length === 3, 'PERSISTENCE + NO DUP SEED: still exactly 3 postings after reseed on boot', persistedMine.json?.length);

  const postRestartMatches = await api('GET', '/api/postings/matches', { token: studentToken });
  const titles = (postRestartMatches.json || []).map((x) => x.title);
  assert(titles.filter((t) => t === 'Frontend Intern').length === 1, 'NO DUP SEED: exactly one Frontend Intern after restart', titles);

  await stopServer(server);

  // ---------- Summary ----------
  console.log(`\n======== RESULTS: ${passed} passed, ${failed} failed ========`);
  if (failed > 0) failures.forEach((f) => console.log(`  FAILED: ${f}`));

  await mongod.stop();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('SMOKE TEST CRASHED:', err.message);
  process.exit(2);
});
