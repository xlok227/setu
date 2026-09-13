import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [selectedRole, setSelectedRole] = useState('student');
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('setuAuth');
    return saved ? JSON.parse(saved) : null;
  });
  const [form, setForm] = useState({
    name: '',
    email: 'student@setu.dev',
    password: 'password123',
    role: 'student',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [studentProfile, setStudentProfile] = useState({ skills: [] });
  const [studentMatches, setStudentMatches] = useState([]);
  const [industryPostings, setIndustryPostings] = useState([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState('');
  const [postingForm, setPostingForm] = useState({
    title: '',
    description: '',
    required_skills: [{ skill_name: '', weight: 'medium' }],
  });

  const dashboardRole = auth?.user?.role || selectedRole;

  useEffect(() => {
    if (auth) {
      localStorage.setItem('setuAuth', JSON.stringify(auth));
      if (auth.user.role === 'student') {
        loadStudentBoard(auth.token);
      } else {
        loadIndustryBoard(auth.token);
      }
    } else {
      localStorage.removeItem('setuAuth');
    }
  }, [auth?.token]);

  const roleSummary = useMemo(() => {
    if (dashboardRole === 'industry') {
      return 'Create internships and review current student matches.';
    }
    return 'Track skill readiness, match quality, and application opportunities.';
  }, [dashboardRole]);

  const profileReadiness = useMemo(() => {
    if (!studentProfile.skills || studentProfile.skills.length === 0) {
      return 0;
    }

    const average = studentProfile.skills.reduce((sum, skill) => sum + Number(skill.proficiency || 0), 0);
    return Math.min(100, Math.round(average / studentProfile.skills.length));
  }, [studentProfile.skills]);

  async function loadStudentBoard(token) {
    setBoardLoading(true);
    setBoardError('');
    try {
      const [profileRes, matchesRes] = await Promise.all([
        fetch(`${API_BASE}/api/assessment/me`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/postings/matches`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      setStudentProfile(profileRes.ok ? await profileRes.json() : { skills: [] });
      setStudentMatches(matchesRes.ok ? await matchesRes.json() : []);
    } catch {
      setStudentProfile({ skills: [] });
      setStudentMatches([]);
      setBoardError('Could not reach the server. Your data may be out of date.');
    } finally {
      setBoardLoading(false);
    }
  }

  async function loadIndustryBoard(token) {
    setBoardLoading(true);
    setBoardError('');
    try {
      const res = await fetch(`${API_BASE}/api/postings/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setIndustryPostings(res.ok ? await res.json() : []);
    } catch {
      setIndustryPostings([]);
      setBoardError('Could not reach the server. Your data may be out of date.');
    } finally {
      setBoardLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload =
        authMode === 'signup'
          ? {
              name: form.name,
              email: form.email,
              password: form.password,
              role: selectedRole,
            }
          : {
              email: form.email,
              password: form.password,
            };

      const response = await fetch(`${API_BASE}/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      const nextAuth = { token: data.token, user: data.user };
      setAuth(nextAuth);
      setSelectedRole(data.user.role);
      setForm((prev) => ({ ...prev, role: data.user.role }));
    } catch (err) {
      setError(err.message || 'Unable to proceed');
    } finally {
      setLoading(false);
    }
  }

  function handleSkillChange(skillName, value) {
    setStudentProfile((prev) => ({
      ...prev,
      skills: (prev.skills || []).map((skill) =>
        skill.skill_name === skillName ? { ...skill, proficiency: Number(value) } : skill
      ),
    }));
  }

  async function saveAssessment() {
    if (!auth || auth.user.role !== 'student') return;

    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE}/api/assessment/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ skills: studentProfile.skills }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Assessment failed');
      }

      setStudentProfile(data.profile || studentProfile);
      await loadStudentBoard(auth.token);
    } catch (err) {
      setError(err.message || 'Assessment update failed');
    } finally {
      setLoading(false);
    }
  }

  function addSkillField() {
    setStudentProfile((prev) => ({
      ...prev,
      skills: [...(prev.skills || []), { skill_name: `New Skill ${((prev.skills || []).length + 1)}`, proficiency: 60 }],
    }));
  }

  function updatePostingSkill(index, field, value) {
    setPostingForm((prev) => ({
      ...prev,
      required_skills: prev.required_skills.map((skill, i) =>
        i === index ? { ...skill, [field]: value } : skill
      ),
    }));
  }

  function addPostingSkill() {
    setPostingForm((prev) => ({
      ...prev,
      required_skills: [...prev.required_skills, { skill_name: 'Communication', weight: 'medium' }],
    }));
  }

  async function createPosting() {
    if (!auth || auth.user.role !== 'industry') return;

    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API_BASE}/api/postings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          title: postingForm.title,
          description: postingForm.description,
          required_skills: postingForm.required_skills,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Posting could not be created');
      }

      setIndustryPostings((prev) => [data.posting, ...prev]);
      setPostingForm({
        title: '',
        description: '',
        required_skills: [{ skill_name: 'Communication', weight: 'medium' }],
      });
    } catch (err) {
      setError(err.message || 'Posting creation failed');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAuth(null);
    setError('');
  }

  if (!auth) {
    const scrollToSection = (view) => {
      const targetId =
        view === 'how' ? 'how-it-works' : view === 'industry' ? 'for-industry' : view === 'about' ? 'about' : 'for-students';
      const target = document.getElementById(targetId);
      if (!target) return;

      const startY = window.scrollY;
      const targetTop = target.getBoundingClientRect().top + startY;

      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      // Fallback: if the smooth animation never engages (e.g. throttled rAF),
      // jump instantly so navigation always works.
      window.setTimeout(() => {
        const moved = Math.abs(window.scrollY - startY) > 10;
        const arrived = Math.abs(window.scrollY - targetTop) < 40;
        if (!moved && !arrived) {
          window.scrollTo({ top: targetTop, behavior: 'instant' });
        }
      }, 600);
    };

    const openAuthSheet = (mode) => {
      setAuthMode(mode);
      setAuthSheetOpen(true);
    };


    return (
      <div className="app-shell landing-shell">
        <div className="landing-page-shell">
          <header className="landing-header">
            <div className="brand-lockup">
              <div className="brand-mark">S</div>
              <div className="brand-text">setu.</div>
            </div>

            <nav className="landing-menu" aria-label="Main navigation">
              <button type="button" className="menu-link" onClick={() => scrollToSection('how')}>How it works</button>
              <button type="button" className="menu-link" onClick={() => scrollToSection('students')}>For students</button>
              <button type="button" className="menu-link" onClick={() => scrollToSection('industry')}>For industry</button>
              <button type="button" className="menu-link" onClick={() => scrollToSection('about')}>About</button>
            </nav>

            <div className="header-actions">
              <button type="button" className="login-ghost" onClick={() => openAuthSheet('login')}>Log in</button>
              <button type="button" className="prime-cta" onClick={() => openAuthSheet('signup')}>
                Create profile <span>→</span>
              </button>
            </div>
          </header>

          {authSheetOpen && (
            <>
              <div className="landing-auth-backdrop" onClick={() => setAuthSheetOpen(false)} />
              <div className="landing-auth-sheet">
              <div className="landing-auth-card">
                <div className="landing-auth-header">
                  <div>
                    <p className="eyebrow">Welcome to Setu</p>
                    <h3>{authMode === 'login' ? 'Log in' : 'Create your profile'}</h3>
                  </div>
                  <button className="close-auth" type="button" onClick={() => setAuthSheetOpen(false)}>×</button>
                </div>

                <form className="landing-auth-form" onSubmit={handleAuthSubmit}>
                  {authMode === 'signup' && (
                    <label>
                      Full name
                      <input name="name" value={form.name} onChange={handleChange} placeholder="Aisha Gupta" />
                    </label>
                  )}

                  <label>
                    Email
                    <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@example.com" />
                  </label>

                  <label>
                    Password
                    <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
                  </label>

                  {authMode === 'signup' && (
                    <div className="role-picker">
                      <button
                        type="button"
                        className={selectedRole === 'student' ? 'role-option active' : 'role-option'}
                        onClick={() => setSelectedRole('student')}
                      >
                        <strong>Student</strong>
                        <small>Find matched internships</small>
                      </button>
                      <button
                        type="button"
                        className={selectedRole === 'industry' ? 'role-option active' : 'role-option'}
                        onClick={() => setSelectedRole('industry')}
                      >
                        <strong>Industry</strong>
                        <small>Post roles &amp; hire</small>
                      </button>
                    </div>
                  )}

                  {error && <div className="error-box">{error}</div>}

                  <button className="primary-button" type="submit" disabled={loading}>
                    {loading ? 'Please wait…' : authMode === 'login' ? 'Continue' : 'Create account'}
                  </button>
                </form>
              </div>
              </div>
            </>
          )}

          <main className="landing-main">
            <section className="hero-callout">
              <div className="hero-copy-column">
                <div className="hero-badge">✦ BUILT FOR THE NEXT STEP</div>

                <h1 className="hero-title">
                  <span>Skills should open</span>
                  <span>doors.</span>
                  <span className="accent-word">Not</span>
                  <span className="accent-word">gatekeep them.</span>
                </h1>

                <p className="hero-description">
                  Setu turns what you can do into where you can go — with a clear skill profile,
                  honest gaps, and opportunities matched to your actual potential.
                </p>
              </div>

              <aside className="profile-preview-card">
                <div className="profile-card-header">
                  <span>YOUR SKILL PROFILE</span>
                  <span className="mini-pill">78% complete</span>
                </div>

                <div className="profile-user">Aarav Mehta</div>
                <div className="profile-role">Frontend developer in the making</div>

                <div className="skill-bars">
                  <div className="skill-row">
                    <span>React</span>
                    <div className="bar-track"><div className="bar-fill orange" style={{ width: '88%' }} /></div>
                    <strong>88/100</strong>
                  </div>

                  <div className="skill-row">
                    <span>JavaScript</span>
                    <div className="bar-track"><div className="bar-fill amber" style={{ width: '82%' }} /></div>
                    <strong>82/100</strong>
                  </div>

                  <div className="skill-row">
                    <span>UI systems</span>
                    <div className="bar-track"><div className="bar-fill mint" style={{ width: '74%' }} /></div>
                    <strong>74/100</strong>
                  </div>
                </div>

                <div className="match-tile">
                  <div className="match-label">Top opportunity match</div>
                  <div className="match-row">
                    <strong>Frontend Engineering Intern</strong>
                    <span className="score-badge">94%</span>
                  </div>
                  <div className="match-meta">✓ Strong React + UI systems overlap</div>
                </div>
              </aside>
            </section>

            <section id="for-students" className="students-section">
              <div className="students-copy">
                <div className="section-kicker">FOR STUDENTS</div>
                <h2>Your potential is bigger than your résumé.</h2>
                <p>
                  Build a profile that shows how you think, not just where you studied. Find roles that meet you at your current level — and help you grow.
                </p>

                <ul className="check-list">
                  <li>Skill profile generated from a guided assessment</li>
                  <li>Match scores you can actually understand</li>
                  <li>One calm place to track every application</li>
                </ul>
              </div>

              <div className="growth-card">
                <div className="growth-header">
                  <span>Where you can grow next</span>
                  <span className="growth-tag">3 focus areas</span>
                </div>

                <div className="focus-row">
                  <span>Testing</span>
                  <div className="bar-track wide"><div className="bar-fill orange" style={{ width: '42%' }} /></div>
                  <strong>42 → 76</strong>
                </div>

                <div className="focus-row">
                  <span>SQL</span>
                  <div className="bar-track wide"><div className="bar-fill orange" style={{ width: '39%' }} /></div>
                  <strong>39 → 70</strong>
                </div>

                <div className="focus-row">
                  <span>System design</span>
                  <div className="bar-track wide"><div className="bar-fill orange" style={{ width: '28%' }} /></div>
                  <strong>28 → 64</strong>
                </div>

                <div className="growth-tip">? Close the gap, don&apos;t chase every skill.</div>
              </div>
            </section>

            <section id="how-it-works" className="route-forward-section">
              <p className="route-forward-label">A clearer route forward</p>

              <h2 className="route-forward-title">
                <span>From “I’m not sure”</span>
                <span>to “this is my next</span>
                <span>step.”</span>
              </h2>

              <div className="route-grid">
                <article className="route-card">
                  <div className="route-topline">
                    <span className="route-icon">◎</span>
                    <span className="route-number">01</span>
                  </div>
                  <h3>Show your skills</h3>
                  <p>A quick, practical assessment turns your strengths into a profile.</p>
                </article>

                <article className="route-card">
                  <div className="route-topline">
                    <span className="route-icon">◉</span>
                    <span className="route-number">02</span>
                  </div>
                  <h3>See your fit</h3>
                  <p>Get ranked opportunities and a plain-English reason why they fit.</p>
                </article>

                <article className="route-card">
                  <div className="route-topline">
                    <span className="route-icon">⌁</span>
                    <span className="route-number">03</span>
                  </div>
                  <h3>Keep moving</h3>
                  <p>Close the gaps that matter and track every application in one place.</p>
                </article>
              </div>
            </section>

            <section id="for-industry" className="students-section">
              <div className="students-copy">
                <div className="section-kicker">FOR INDUSTRY</div>
                <h2>Hire for potential, verified by skills.</h2>
                <p>
                  Post internships in minutes and get a ranked shortlist of candidates whose
                  skills actually match the role — with the reasoning shown, not hidden.
                </p>

                <ul className="check-list">
                  <li>Reach students by verified skill proficiency, not keywords</li>
                  <li>Every candidate comes with an explainable match score</li>
                  <li>One place to publish roles and track interest</li>
                </ul>
              </div>

              <div className="growth-card">
                <div className="growth-header">
                  <span>What hiring with Setu looks like</span>
                  <span className="growth-tag">3 outcomes</span>
                </div>

                <div className="focus-row">
                  <span>Skill-verified applicants</span>
                  <div className="bar-track wide"><div className="bar-fill mint" style={{ width: '87%' }} /></div>
                  <strong>87%</strong>
                </div>

                <div className="focus-row">
                  <span>Faster shortlisting</span>
                  <div className="bar-track wide"><div className="bar-fill amber" style={{ width: '64%' }} /></div>
                  <strong>-40% time</strong>
                </div>

                <div className="focus-row">
                  <span>Match transparency</span>
                  <div className="bar-track wide"><div className="bar-fill orange" style={{ width: '100%' }} /></div>
                  <strong>Every score explained</strong>
                </div>

                <div className="growth-tip">? Post a role and see your ranked matches in minutes.</div>
              </div>
            </section>

            <section id="about" className="about-setu-section">
              <p className="about-label">About Setu</p>

              <h2 className="about-heading">A bridge, by design.</h2>

              <p className="about-lead">
                Setu means <span>bridge</span>. We&apos;re building the missing connection between the
                skills people are growing and the opportunities that need them.
              </p>

              <p className="about-sublead">
                Our first loop is intentionally focused: make skills visible, make matching explainable,
                and make the next step feel doable. No black boxes. No résumé roulette. Just a clearer
                way for students and teams to find the right fit.
              </p>

              <div className="about-value-grid">
                <div className="about-value-item">
                  <div className="about-icon">⟡</div>
                  <h3>Built for momentum</h3>
                  <p>Small next steps over vague advice.</p>
                </div>

                <div className="about-value-item">
                  <div className="about-icon success">✓</div>
                  <h3>Explainable by default</h3>
                  <p>Every match has a reason.</p>
                </div>

                <div className="about-value-item">
                  <div className="about-icon focus">◌</div>
                  <h3>Human-centered</h3>
                  <p>Technology that stays legible.</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  const skills = auth.user.role === 'student' ? (studentProfile.skills || []) : [];
  const topMatch = studentMatches[0] || null;
  const strongSkills = skills.filter((s) => Number(s.proficiency) >= 70).length;

  const studentStats = [
    { label: 'Readiness', value: `${profileReadiness}%`, tone: 'cyan' },
    { label: 'Top match', value: topMatch ? `${Math.round(topMatch.final_score)}%` : '—', tone: 'green' },
    { label: 'Skills listed', value: skills.length, tone: 'dark' },
    { label: 'Strong (70+)', value: strongSkills, tone: 'amber' },
  ];

  const industryStats = (() => {
    const skillNames = new Set();
    let highCount = 0;
    industryPostings.forEach((p) => (p.required_skills || []).forEach((s) => {
      skillNames.add(s.skill_name);
      if (s.weight === 'high') highCount += 1;
    }));
    return [
      { label: 'Open roles', value: industryPostings.length, tone: 'cyan' },
      { label: 'Skills required', value: skillNames.size, tone: 'dark' },
      { label: 'High-priority asks', value: highCount, tone: 'green' },
    ];
  })();

  return (
    <div className="app-shell dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-badge">S</div>
          <div>
            <p className="eyebrow">Setu</p>
            <h2>{auth.user.role === 'industry' ? 'Industry' : 'Student'}</h2>
          </div>
        </div>

        <nav className="nav-stack">
          <button className="nav-item active" type="button">Overview</button>
          <button className="nav-item" type="button">Matches</button>
          <button className="nav-item" type="button">Insights</button>
          <button className="nav-item danger" type="button" onClick={logout}>Logout</button>
        </nav>

        <div className="profile-card">
          <p className="label">Signed in</p>
          <strong>{auth.user.name}</strong>
          <span>{auth.user.email}</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Portal summary</p>
            <h1>{auth.user.role === 'industry' ? 'Hiring dashboard' : 'Student dashboard'}</h1>
          </div>
          <div className="summary-pill">{roleSummary}</div>
        </header>

        <div className={`insight-row ${auth.user.role === 'student' ? 'four' : 'three'}`}>
          {(auth.user.role === 'student' ? studentStats : industryStats).map((item) => (
            <div className={`mini-stat ${item.tone}`} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        {(error || boardError) && <div className="error-box">{error || boardError}</div>}

        {auth.user.role === 'student' ? (
          <div className="section-grid dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <h3>Skill profile</h3>
                <button className="secondary-button" type="button" onClick={addSkillField}>Add skill</button>
              </div>

              <div className="readiness-block">
                <div
                  className={`readiness-ring ${profileReadiness >= 70 ? 'good' : profileReadiness >= 40 ? 'mid' : 'low'}`}
                  style={{ '--val': profileReadiness }}
                >
                  <span>{profileReadiness}%</span>
                </div>
                <div className="readiness-copy">
                  <strong>
                    {profileReadiness >= 70 ? 'Interview-ready profile' : profileReadiness >= 40 ? 'Getting there' : 'Just getting started'}
                  </strong>
                  <p>Save your assessment to refresh matches and close skill gaps.</p>
                </div>
              </div>

              <div className="skill-list">
                {skills.map((skill) => (
                  <div className="skill-row" key={skill.skill_name}>
                    <input
                      className="skill-name-input"
                      type="text"
                      value={skill.skill_name}
                      aria-label="Skill name"
                      onChange={(event) => {
                        setStudentProfile((prev) => ({
                          ...prev,
                          skills: prev.skills.map((item) =>
                            item.skill_name === skill.skill_name ? { ...item, skill_name: event.target.value } : item
                          ),
                        }));
                      }}
                    />
                    <input
                      className="skill-range"
                      type="range"
                      min="0"
                      max="100"
                      value={skill.proficiency}
                      style={{ '--fill': `${skill.proficiency}%` }}
                      aria-label={`${skill.skill_name} proficiency`}
                      onChange={(event) => handleSkillChange(skill.skill_name, event.target.value)}
                    />
                    <strong>{skill.proficiency}%</strong>
                  </div>
                ))}
                {skills.length === 0 && !boardLoading && (
                  <div className="empty-state">No skills yet — add your first one and save to unlock matches.</div>
                )}
              </div>

              <button className="primary-button" type="button" onClick={saveAssessment} disabled={loading}>
                {loading ? 'Saving…' : 'Save assessment'}
              </button>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Matched internships</h3>
                {studentMatches.length > 0 && <span className="panel-chip">{studentMatches.length} open roles</span>}
              </div>

              {boardLoading ? (
                <div className="empty-state">Loading your matches…</div>
              ) : studentMatches.length === 0 ? (
                <div className="empty-state">
                  <strong>No matches yet.</strong>
                  <p>Add a few skills and save — we&apos;ll rank open internships for you automatically.</p>
                </div>
              ) : (
                <div className="match-list">
                  {studentMatches.map((match) => {
                    const pct = Math.round(match.final_score);
                    const covered = new Set(skills.map((s) => String(s.skill_name).toLowerCase()));
                    return (
                      <article key={match.posting_id || match._id} className="match-card">
                        <div className="match-header">
                          <div>
                            <h4>{match.title}</h4>
                            <p>{match.industrial_name || match.industry?.name || 'Industry partner'}</p>
                          </div>
                          <span className={`score-badge ${pct >= 60 ? 'high' : pct >= 30 ? 'mid' : 'low'}`}>{pct}%</span>
                        </div>

                        <p>{match.description}</p>

                        <div className="coverage-bar"><span style={{ width: `${pct}%` }} /></div>
                        <div className="meta-row">
                          <span>Skill fit {Math.round(match.match_score)}%</span>
                          <span>Covers {Math.round((match.coverage_ratio || 0) * 100)}% of requirements</span>
                        </div>

                        <ul className="tag-list">
                          {(match.required_skills || []).map((skill, idx) => {
                            const hasIt = covered.has(String(skill.skill_name).toLowerCase());
                            return (
                              <li key={`${match.posting_id || match._id}-${skill.skill_name}-${idx}`} className={hasIt ? 'have' : 'need'}>
                                {hasIt ? '✓' : '+'} {skill.skill_name}
                              </li>
                            );
                          })}
                        </ul>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="section-grid">
            <section className="panel">
              <div className="panel-header">
                <h3>Create internship</h3>
              </div>

              <div className="posting-form">
                <label>
                  Title
                  <input
                    value={postingForm.title}
                    onChange={(event) => setPostingForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="AI Product Analyst"
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={postingForm.description}
                    onChange={(event) => setPostingForm((prev) => ({ ...prev, description: event.target.value }))}
                    rows="4"
                    placeholder="Describe the internship and outcomes."
                  />
                </label>

                <div className="skill-editor">
                  {postingForm.required_skills.map((skill, index) => (
                    <div className="mini-skill" key={`${skill.skill_name}-${index}`}>
                      <input
                        value={skill.skill_name}
                        onChange={(event) => updatePostingSkill(index, 'skill_name', event.target.value)}
                      />
                      <select
                        value={skill.weight}
                        onChange={(event) => updatePostingSkill(index, 'weight', event.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  ))}
                </div>

                <div className="button-row">
                  <button className="secondary-button" type="button" onClick={addPostingSkill}>Add skill</button>
                  <button className="primary-button" type="button" onClick={createPosting} disabled={loading}>
                    {loading ? 'Creating…' : 'Publish internship'}
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h3>Current postings</h3>
              </div>

              <div className="match-list">
                {industryPostings.map((posting) => (
                  <article key={posting._id || posting.posting_id} className="match-card">
                    <div className="match-header">
                      <div>
                        <h4>{posting.title}</h4>
                        <p>{posting.status || 'Open'}</p>
                      </div>
                    </div>
                    <p>{posting.description}</p>
                    <ul className="tag-list">
                      {(posting.required_skills || []).map((skill, idx) => (
                        <li key={`${posting._id || posting.posting_id}-${skill.skill_name}-${idx}`}>
                          {skill.skill_name} · {skill.weight}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
