const jwt = require('jsonwebtoken');

// Middleware to verify JWT token from Authorization header
const authenticateToken = (req, res, next) => {
  try {
    // Extract token from Authorization header (Bearer <token>)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'yoursecretkey123');

    // Attach decoded token to request object for downstream routes
    req.user = decoded;
    req.classId = decoded.classId;
    req.className = decoded.className;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    return res.status(403).json({ error: 'Token verification failed' });
  }
};

module.exports = authenticateToken;