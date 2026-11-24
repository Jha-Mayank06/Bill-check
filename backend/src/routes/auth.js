const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { signToken, requireAuth } = require('../auth');
const { str } = require('../validate');
const { HttpError } = require('../errors');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many login attempts, try again in a few minutes' },
});

router.post('/login', loginLimiter, async (req, res) => {
  const empId = str(req.body, 'empId', { max: 50 });
  const password = str(req.body, 'password', { max: 128 });
  const { rows } = await db.query('SELECT * FROM users WHERE lower(emp_id) = lower($1)', [empId]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Wrong employee ID or password');
  if (!user.active) throw new HttpError(401, 'Account is disabled, contact your admin');
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

function publicUser(u) {
  return { id: u.id, empId: u.emp_id, name: u.name, phone: u.phone, role: u.role, active: u.active };
}

module.exports = { router, publicUser };
