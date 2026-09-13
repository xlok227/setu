const bcryptjs = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Posting = require('../models/Posting');
const { connectDB } = require('../data/db');

/**
 * Idempotent seed: creates the demo student, industry user, student profile,
 * and two sample postings. Safe to run multiple times.
 */
async function seedDemoData() {
  const passwordHash = await bcryptjs.hash('password123', 10);

  // --- Demo users ---
  const student = await User.findOneAndUpdate(
    { email: 'student@setu.dev' },
    {
      $setOnInsert: {
        name: 'Student Demo',
        email: 'student@setu.dev',
        password_hash: passwordHash,
        role: 'student',
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const industry = await User.findOneAndUpdate(
    { email: 'industry@setu.dev' },
    {
      $setOnInsert: {
        name: 'Industry Demo',
        email: 'industry@setu.dev',
        password_hash: passwordHash,
        role: 'industry',
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  // --- Student profile (starts empty; students fill it via the assessment) ---
  await StudentProfile.updateOne(
    { user_id: student._id },
    { $setOnInsert: { user_id: student._id, skills: [], assessment_history: [] } },
    { upsert: true }
  );

  // --- Postings ---
  const postings = [
    {
      title: 'Frontend Intern',
      description: 'Build UI flows for campus collaboration dashboards and onboarding experiments.',
      required_skills: [
        { skill_name: 'React', weight: 'high' },
        { skill_name: 'JavaScript', weight: 'high' },
        { skill_name: 'Design', weight: 'medium' },
      ],
    },
    {
      title: 'Data & Insights Intern',
      description: 'Analyze student engagement and improve matching quality for internship recommendations.',
      required_skills: [
        { skill_name: 'Python', weight: 'high' },
        { skill_name: 'SQL', weight: 'high' },
        { skill_name: 'Communication', weight: 'medium' },
      ],
    },
  ];

  for (const posting of postings) {
    await Posting.updateOne(
      { title: posting.title, industry_id: industry._id },
      { $setOnInsert: { ...posting, industry_id: industry._id, status: 'open' } },
      { upsert: true }
    );
  }

  console.log('Seed complete: demo users, student profile, and postings are ready.');
}

module.exports = { seedDemoData };

// Allow running directly: `node utils/seed.js`
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedDemoData();
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('Seed failed:', err.message);
      process.exit(1);
    }
  })();
}
