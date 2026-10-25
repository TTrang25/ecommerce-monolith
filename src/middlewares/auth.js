const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { HttpError } = require('./error');

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing or invalid Authorization header'));
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { uid: payload.uid, role: payload.role };
    next();
  } catch (e) {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};