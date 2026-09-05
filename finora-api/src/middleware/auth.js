const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  const secret = process.env.JWT_SECRET || 'finora_dev_jwt_secret_key_change_in_production';

  jwt.verify(token, secret, (err, user) => {
    if (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();
  });
}

module.exports = authenticateToken;
