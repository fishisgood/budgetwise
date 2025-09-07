import User from '../models/User.js';

export const getCurrentUser = async (req, res) => {
  try {
        if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // req.userId מגיע מה-middleware שמבצע אימות JWT
    if (!req.user.id) return res.sendStatus(401);
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'createdAt', 'updatedAt']
    });
    if (!user) return res.sendStatus(404);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};