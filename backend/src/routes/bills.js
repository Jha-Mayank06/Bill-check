const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireRole } = require('../auth');
const { str, phone } = require('../validate');
const { bad, notFound, forbidden, conflict, HttpError } = require('../errors');
const { getSmsProvider } = require('../sms');

const router = express.Router();
router.use(requireAuth);

const STATUSES = ['created', 'assigned', 'loaded', 'left', 'delivered', 'cancelled'];
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const SELECT_BILL = `
  SELECT b.*, d.name AS driver_name, d.emp_id AS driver_emp_id
  FROM bills b LEFT JOIN users d ON d.id = b.driver_id`;

function toBill(r) {
  const end = r.reached_at || null;
  return {
    id: r.id,
    billNo: r.bill_no,
    receiverName: r.receiver_name,
    receiverPhone: r.receiver_phone,
    address: r.address,
    lotDetails: r.lot_details,
    status: r.status,
    cashier: { id: r.cashier_id, name: r.cashier_name },
    driver: r.driver_id ? { id: r.driver_id, name: r.driver_name, empId: r.driver_emp_id } : null,
    createdAt: r.created_at,
    assignedAt: r.assigned_at,
    loadedAt: r.loaded_at,
    leftAt: r.left_at,
    reachedAt: r.reached_at,
    cancelledAt: r.cancelled_at,
    // Counter-to-customer time, filled once the bill is finalized.
    durationMinutes: end ? Math.round((new Date(end) - new Date(r.created_at)) / 60000) : null,
    finalized: r.status === 'delivered',
  };
}

async function loadBill(client, id, { lock = false } = {}) {
  if (!isUuid(id)) throw notFound('Bill not found');
  const sql = lock
    ? 'SELECT * FROM bills WHERE id = $1 FOR UPDATE'
    : `${SELECT_BILL} WHERE b.id = $1`;
  const { rows } = await client.query(sql, [id]);
  if (!rows[0]) throw notFound('Bill not found');
  return rows[0];
}

async function logEvent(client, billId, event, user, note = null) {
  await client.query(
    'INSERT INTO bill_events (bill_id, event, actor_id, actor_name, note) VALUES ($1, $2, $3, $4, $5)',
    [billId, event, user?.id ?? null, user?.name ?? null, note],
  );
}

async function fetchBill(client, id) {
  return toBill(await loadBill(client, id));
}

async function activeDriver(client, driverId) {
  const id = Number(driverId);
  if (!Number.isInteger(id)) throw bad('driverId must be a number');
  const { rows } = await client.query(
    "SELECT id, name FROM users WHERE id = $1 AND role = 'driver' AND active",
    [id],
  );
  if (!rows[0]) throw bad('Driver not found or disabled');
  return rows[0];
}

const hashOtp = (billId, otp) => crypto.createHash('sha256').update(`${billId}:${otp}`).digest('hex');

async function issueOtp(client, bill) {
  if (bill.otp_sent_count >= config.otpMaxSends) {
    throw new HttpError(429, 'OTP was sent too many times for this bill, contact the counter');
  }
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await client.query(
    `UPDATE bills SET otp_hash = $2, otp_expires_at = now() + make_interval(mins => $3),
       otp_attempts = 0, otp_sent_count = otp_sent_count + 1 WHERE id = $1`,
    [bill.id, hashOtp(bill.id, otp), config.otpTtlMinutes],
  );
  const { shownInApp } = await getSmsProvider().sendOtp({
    phone: bill.receiver_phone,
    otp,
    billNo: bill.bill_no,
  });
  return shownInApp ? { testOtp: otp } : {};
}

// ---------- Listing ----------

// Admin and cashier see every bill. A driver sees only the bills assigned to them.
router.get('/', async (req, res) => {
  const { status, q, driverId, from, to } = req.query;
  const params = [];
  const where = [];
  // Each "?" in sql is replaced by the placeholder of val.
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (req.user.role === 'driver') add('b.driver_id = ?', req.user.id);
  else if (driverId) add('b.driver_id = ?', Number(driverId) || 0);
  if (status) {
    const list = String(status).split(',');
    if (list.some((s) => !STATUSES.includes(s))) throw bad('Unknown status');
    add('b.status = ANY(?::bill_status[])', list);
  }
  if (q) add('(b.bill_no ILIKE ? OR b.receiver_name ILIKE ? OR b.receiver_phone ILIKE ?)', `%${q}%`);
  if (from) add('b.created_at >= ?::timestamptz', from);
  if (to) add('b.created_at < ?::timestamptz', to);
  const limit = Math.min(Math.max(Math.floor(Number(req.query.limit)) || 50, 1), 200);
  const offset = Math.max(Math.floor(Number(req.query.offset)) || 0, 0);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await db.query(
    `${SELECT_BILL} ${whereSql} ORDER BY b.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  res.json({ bills: rows.map(toBill), limit, offset });
});

router.get('/:id', async (req, res) => {
  const bill = await loadBill(db, req.params.id);
  if (req.user.role === 'driver' && bill.driver_id !== req.user.id) throw forbidden('This bill is not assigned to you');
  const { rows: events } = await db.query(
    'SELECT event, actor_name, note, at FROM bill_events WHERE bill_id = $1 ORDER BY at, id',
    [bill.id],
  );
  res.json({
    bill: toBill(bill),
    events: events.map((e) => ({ event: e.event, by: e.actor_name, note: e.note, at: e.at })),
  });
});

// ---------- Cashier (counter) ----------

router.post('/', requireRole('cashier', 'admin'), async (req, res) => {
  const body = req.body || {};
  const billNo = str(body, 'billNo', { max: 50 });
  const receiverName = str(body, 'receiverName', { max: 100 });
  const receiverPhone = phone(body, 'receiverPhone');
  const address = str(body, 'address', { required: false, max: 300 });
  const lotDetails = str(body, 'lotDetails', { required: false, max: 1000 });

  const bill = await db.tx(async (client) => {
    const driver = body.driverId ? await activeDriver(client, body.driverId) : null;
    let row;
    try {
      ({ rows: [row] } = await client.query(
        `INSERT INTO bills (bill_no, receiver_name, receiver_phone, address, lot_details,
                            cashier_id, cashier_name, driver_id, status, assigned_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $8::int IS NULL THEN NULL ELSE now() END)
         RETURNING id`,
        [billNo, receiverName, receiverPhone, address, lotDetails, req.user.id, req.user.name,
          driver?.id ?? null, driver ? 'assigned' : 'created'],
      ));
    } catch (err) {
      if (err.code === '23505') throw conflict(`Bill number ${billNo} already exists`);
      throw err;
    }
    await logEvent(client, row.id, 'created', req.user);
    if (driver) await logEvent(client, row.id, 'assigned', req.user, `Driver: ${driver.name}`);
    return fetchBill(client, row.id);
  });
  res.status(201).json({ bill });
});

// Assign or re-assign a driver, allowed until the driver marks the lot as loaded.
router.post('/:id/assign', requireRole('cashier', 'admin'), async (req, res) => {
  const bill = await db.tx(async (client) => {
    const current = await loadBill(client, req.params.id, { lock: true });
    if (!['created', 'assigned'].includes(current.status)) {
      throw conflict(`Cannot change the driver once the bill is ${current.status}`);
    }
    const driver = await activeDriver(client, req.body?.driverId);
    await client.query(
      "UPDATE bills SET driver_id = $2, status = 'assigned', assigned_at = now() WHERE id = $1",
      [current.id, driver.id],
    );
    await logEvent(client, current.id, current.driver_id ? 'reassigned' : 'assigned', req.user, `Driver: ${driver.name}`);
    return fetchBill(client, current.id);
  });
  res.json({ bill });
});

router.post('/:id/cancel', requireRole('cashier', 'admin'), async (req, res) => {
  const reason = str(req.body || {}, 'reason', { required: false, max: 300 });
  const bill = await db.tx(async (client) => {
    const current = await loadBill(client, req.params.id, { lock: true });
    if (['delivered', 'cancelled'].includes(current.status)) throw conflict(`Bill is already ${current.status}`);
    await client.query(
      "UPDATE bills SET status = 'cancelled', cancelled_at = now(), otp_hash = NULL WHERE id = $1",
      [current.id],
    );
    await logEvent(client, current.id, 'cancelled', req.user, reason);
    return fetchBill(client, current.id);
  });
  res.json({ bill });
});

// ---------- Driver ----------

function driverStep(from, to, column, event, { afterUpdate } = {}) {
  return async (req, res) => {
    const result = await db.tx(async (client) => {
      const current = await loadBill(client, req.params.id, { lock: true });
      if (current.driver_id !== req.user.id) throw forbidden('This bill is not assigned to you');
      if (current.status !== from) throw conflict(`Bill is ${current.status}, expected ${from}`);
      await client.query(`UPDATE bills SET status = $2, ${column} = now() WHERE id = $1`, [current.id, to]);
      await logEvent(client, current.id, event, req.user);
      const extra = afterUpdate ? await afterUpdate(client, current) : {};
      return { bill: await fetchBill(client, current.id), ...extra };
    });
    res.json(result);
  };
}

router.post('/:id/loaded', requireRole('driver'), driverStep('assigned', 'loaded', 'loaded_at', 'loaded'));

// Leaving with the lot sends the delivery OTP to the customer.
router.post(
  '/:id/left',
  requireRole('driver'),
  driverStep('loaded', 'left', 'left_at', 'left', {
    afterUpdate: async (client, bill) => {
      const out = await issueOtp(client, bill);
      await logEvent(client, bill.id, 'otp_sent', null, `To ${maskPhone(bill.receiver_phone)}`);
      return out;
    },
  }),
);

router.post('/:id/resend-otp', requireRole('driver'), async (req, res) => {
  const result = await db.tx(async (client) => {
    const current = await loadBill(client, req.params.id, { lock: true });
    if (current.driver_id !== req.user.id) throw forbidden('This bill is not assigned to you');
    if (current.status !== 'left') throw conflict('OTP can only be resent while the lot is on the way');
    const out = await issueOtp(client, current);
    await logEvent(client, current.id, 'otp_resent', req.user, `To ${maskPhone(current.receiver_phone)}`);
    return out;
  });
  res.json({ sent: true, ...result });
});

// Customer tells the driver the OTP; driver enters it. This finalizes the bill.
router.post('/:id/deliver', requireRole('driver'), async (req, res) => {
  const otp = str(req.body || {}, 'otp', { max: 10 });
  // Wrong attempts are committed even though the request fails, so they count.
  const outcome = await db.tx(async (client) => {
    const current = await loadBill(client, req.params.id, { lock: true });
    if (current.driver_id !== req.user.id) throw forbidden('This bill is not assigned to you');
    if (current.status !== 'left') throw conflict(`Bill is ${current.status}, expected left`);
    if (!current.otp_hash || new Date(current.otp_expires_at) < new Date()) {
      return { error: new HttpError(400, 'OTP expired, please resend it') };
    }
    if (current.otp_attempts >= config.otpMaxAttempts) {
      return { error: new HttpError(429, 'Too many wrong OTPs, please resend a new one') };
    }
    const given = Buffer.from(hashOtp(current.id, otp));
    const expected = Buffer.from(current.otp_hash);
    if (!crypto.timingSafeEqual(given, expected)) {
      await client.query('UPDATE bills SET otp_attempts = otp_attempts + 1 WHERE id = $1', [current.id]);
      await logEvent(client, current.id, 'otp_failed', req.user);
      const left = config.otpMaxAttempts - current.otp_attempts - 1;
      return { error: new HttpError(400, `Wrong OTP, ${left} attempt${left === 1 ? '' : 's'} left`) };
    }
    await client.query(
      "UPDATE bills SET status = 'delivered', reached_at = now(), otp_hash = NULL WHERE id = $1",
      [current.id],
    );
    await logEvent(client, current.id, 'delivered', req.user, 'OTP verified');
    await logEvent(client, current.id, 'finalized', { id: current.cashier_id, name: current.cashier_name });
    return { bill: await fetchBill(client, current.id) };
  });
  if (outcome.error) throw outcome.error;
  res.json(outcome);
});

const maskPhone = (p) => `******${String(p).slice(-4)}`;

module.exports = router;
