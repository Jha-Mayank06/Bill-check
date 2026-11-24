const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { str, phone, password } = require('../validate');
const { bad, notFound, conflict, forbidden } = require('../errors');
const { publicUser } = require('./auth');

const router = express.Router();
router.use(requireAuth);

const ROLES = ['admin', 'cashier', 'driver'];

// Admin sees everyone. Cashiers may list active drivers so they can assign bills.
router.get('/', requireRole('admin', 'cashier'), async (req, res) => {
  const role = req.query.role;
  if (role && !ROLES.includes(role)) throw bad('Unknown role');
  if (req.user.role === 'cashier' && role !== 'driver') throw forbidden('Cashiers can only list drivers');
  const params = [];
  let where = 'WHERE 1=1';
  if (role) {
    params.push(role);
    where += ` AND role = $${params.length}`;
  }
  if (req.user.role === 'cashier') where += ' AND active';
  const { rows } = await db.query(`SELECT * FROM users ${where} ORDER BY role, name`, params);
  res.json({ users: rows.map(publicUser) });
});

router.post('/', requireRole('admin'), async (req, res) => {
  const role = str(req.body, 'role');
  if (!ROLES.includes(role)) throw bad('role must be admin, cashier or driver');
  const empId = str(req.body, 'empId', { max: 50 });
  if (!/^[A-Za-z0-9._-]+$/.test(empId)) throw bad('empId may only use letters, numbers, dot, dash and underscore');
  const name = str(req.body, 'name', { max: 100 });
  const mobile = phone(req.body, 'phone', { required: false });
  const hash = await bcrypt.hash(password(req.body), 10);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (emp_id, name, phone, role, password_hash, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [empId, name, mobile, role, hash, req.user.id],
    );
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') throw conflict(`Employee ID ${empId} is already taken`);
    throw err;
  }
});

// Update name, phone, active flag, or reset the password.
router.patch('/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) throw notFound();
  const body = req.body || {};
  const sets = [];
  const params = [];
  const add = (col, val) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };
  if ('name' in body) add('name', str(body, 'name', { max: 100 }));
  if ('phone' in body) add('phone', phone(body, 'phone', { required: false }));
  if ('active' in body) {
    if (typeof body.active !== 'boolean') throw bad('active must be true or false');
    if (id === req.user.id && !body.active) throw bad('You cannot disable your own account');
    add('active', body.active);
  }
  if ('password' in body) add('password_hash', await bcrypt.hash(password(body), 10));
  if (!sets.length) throw bad('Nothing to update');
  params.push(id);
  const { rows } = await db.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  if (!rows[0]) throw notFound('User not found');
  res.json({ user: publicUser(rows[0]) });
});

module.exports = router;
