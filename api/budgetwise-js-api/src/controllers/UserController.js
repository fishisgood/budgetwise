import User from '../models/User.js';

// Get the current authenticated user
export const getCurrentUser = async (req, res) => {
  try {
    // Check if the user is authenticated (middleware sets req.user)
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    // Double-check user id exists
    if (!req.user.id) return res.sendStatus(401);

    // Find the user by primary key (id), return selected fields
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'email', 'createdAt', 'updatedAt']
    });

    // If user not found, return 404
    if (!user) return res.sendStatus(404);

    // Return user info as JSON
    res.json(user);
  } catch (err) {
    // Log error and return 500
    console.error(err);
    res.status(500).send('Server error');
  }
};