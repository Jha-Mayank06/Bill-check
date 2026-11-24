const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');
const { HttpError } = require('./errors');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// Verifies the bearer token and loads the user fresh, so a disabled account
// is locked out immediately.
async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please log in'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new HttpError(401, 'Session expired, please log in again'));
  }
  const { rows } = await db.query(
    'SELECT id, emp_id, name, phone, role, active FROM users WHERE id = $1',
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.active) return next(new HttpError(401, 'Account is disabled'));
  req.user = user;
  next();
}

const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'Not allowed for your role'));

module.exports = { signToken, requireAuth, requireRole };
