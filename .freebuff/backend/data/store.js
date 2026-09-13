const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const Posting = require('../models/Posting');
const { calculateMatchScore } = require('../utils/matchingEngine');

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

async function createUser({ name, email, password_hash, role }) {
  const exists = await findUserByEmail(email);
  if (exists) return null;

  const user = await User.create({ name, email, password_hash, role });
  return user.toObject();
}

async function findUserByEmail(email) {
  const user = await User.findOne({ email: String(email).toLowerCase() }).lean();
  return user || null;
}

async function getUserById(userId) {
  const user = await User.findById(userId).lean();
  return user || null;
}

async function ensureStudentProfile(userId) {
  const existing = await StudentProfile.findOne({ user_id: userId });
  if (existing) return existing.toObject();

  const profile = await StudentProfile.create({ user_id: userId, skills: [], assessment_history: [] });
  return profile.toObject();
}

async function getStudentProfileByUserId(userId) {
  const profile = await StudentProfile.findOne({ user_id: userId }).lean();
  return profile || null;
}

async function saveStudentProfile({ userId, skills }) {
  const profile = await StudentProfile.findOne({ user_id: userId });

  if (profile) {
    if (profile.skills.length > 0) {
      profile.assessment_history.push({
        date: new Date(),
        skills_snapshot: profile.skills,
      });
    }
    profile.skills = skills;
    await profile.save();
    return profile.toObject();
  }

  const created = await StudentProfile.create({ user_id: userId, skills, assessment_history: [] });
  return created.toObject();
}

async function getOpenPostings() {
  const postings = await Posting.find({ status: 'open' })
    .populate('industry_id', 'name email')
    .lean();

  return postings.map((posting) => ({
    ...posting,
    industry_id: posting.industry_id || { name: 'Industry partner', email: '' },
  }));
}

async function getMyPostings(userId) {
  const postings = await Posting.find({ industry_id: userId }).sort({ createdAt: -1 }).lean();
  return postings;
}

async function createPosting({ industryId, title, description, requiredSkills }) {
  const posting = await Posting.create({
    industry_id: industryId,
    title,
    description,
    required_skills: requiredSkills,
    status: 'open',
  });
  return posting.toObject();
}

async function getMatchesForStudent(userId) {
  const profile = await getStudentProfileByUserId(userId);
  if (!profile) return [];

  const openPostings = await getOpenPostings();

  const matches = openPostings.map((posting) => {
    const scores = calculateMatchScore(profile.skills, posting.required_skills);
    return {
      posting_id: String(posting._id),
      title: posting.title,
      description: posting.description,
      industry: posting.industry_id,
      required_skills: posting.required_skills,
      ...scores,
    };
  });

  return matches.sort((a, b) => b.final_score - a.final_score);
}

module.exports = {
  sanitizeUser,
  createUser,
  findUserByEmail,
  getUserById,
  ensureStudentProfile,
  getStudentProfileByUserId,
  saveStudentProfile,
  getOpenPostings,
  getMyPostings,
  createPosting,
  getMatchesForStudent,
};
