const { getOpenPostings, getMyPostings, createPosting, getMatchesForStudent } = require('../data/store');

exports.createPosting = async (req, res) => {
  try {
    if (req.user.role !== 'industry') {
      return res.status(403).json({ message: 'Only industry accounts can create postings' });
    }

    const { title, description, required_skills } = req.body;

    if (!title || !description || !required_skills || required_skills.length === 0) {
      return res.status(400).json({ message: 'Title, description, and required skills are required' });
    }

    const posting = await createPosting({
      industryId: req.user.id,
      title,
      description,
      requiredSkills: required_skills,
    });

    res.status(201).json({ message: 'Posting created', posting });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getAllPostings = async (req, res) => {
  try {
    const postings = await getOpenPostings();
    res.status(200).json(postings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMyPostings = async (req, res) => {
  try {
    if (req.user.role !== 'industry') {
      return res.status(403).json({ message: 'Only industry accounts can view this' });
    }

    const postings = await getMyPostings(req.user.id);
    res.status(200).json(postings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMatches = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can view matches' });
    }

    const matches = await getMatchesForStudent(req.user.id);
    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};