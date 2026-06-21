const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

console.log('🔐 Auth router module initializing');

// Route: GET /classes
// Fetch all available class names from environment variables
router.get('/classes', (req, res) => {
  console.log('📍 GET /classes endpoint called');
  try {
    const classes = [];
    let classIndex = 1;

    // Extract CLASS_X_NAME from environment variables
    while (process.env[`CLASS_${classIndex}_NAME`]) {
      classes.push({
        id: classIndex,
        name: process.env[`CLASS_${classIndex}_NAME`],
      });
      classIndex++;
    }

    console.log(`✅ Found ${classes.length} classes`);

    if (classes.length === 0) {
      return res.status(400).json({ error: 'No classes configured in environment' });
    }

    res.json({ classes });
  } catch (error) {
    console.error('❌ Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Route: POST /login
// Login with class name and password, return JWT token
router.post('/login', (req, res) => {
  console.log('📍 POST /login endpoint called with body:', req.body);
  try {
    const { className, password } = req.body;

    if (!className || !password) {
      return res.status(400).json({ error: 'Class name and password are required' });
    }

    // Find the class by name
    let classIndex = null;
    let foundClassName = null;

    for (let i = 1; i <= 10; i++) {
      if (process.env[`CLASS_${i}_NAME`] === className) {
        classIndex = i;
        foundClassName = className;
        break;
      }
    }

    if (!classIndex) {
      return res.status(401).json({ error: 'Invalid class name' });
    }

    // Verify password
    const expectedPassword = process.env[`CLASS_${classIndex}_PASSWORD`];
    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        classId: classIndex,
        className: foundClassName,
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET || 'yoursecretkey123',
      { expiresIn: '24h' }
    );

    console.log(`✅ Login successful for: ${foundClassName}`);

    res.json({
      token,
      className: foundClassName,
      classId: classIndex,
    });
  } catch (error) {
    console.error('❌ Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

console.log('🔐 Auth router configured and exported');
module.exports = router;