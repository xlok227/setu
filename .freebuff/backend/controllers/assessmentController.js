const { getStudentProfileByUserId, saveStudentProfile, getUserById } = require('../data/store');

exports.submitAssessment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { skills } = req.body;

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ message: 'Skills array is required' });
    }

    const profile = await saveStudentProfile({ userId, skills });
    res.status(200).json({ message: 'Assessment saved', profile });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await getStudentProfileByUserId(userId);

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const user = await getUserById(userId);

    res.status(200).json({
      ...profile,
      user_id: user
        ? { id: String(user._id), name: user.name, email: user.email }
        : { id: String(userId) },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};