// End-to-end API tests. Needs a throwaway Postgres database in TEST_DATABASE_URL.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/billcheck_test';
process.env.SMS_PROVIDER = 'console';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { pool, migrate } = require('../src/db');

const api = request(app);
const tokens = {};
const ids = {};

const as = (who) => ({
  get: (url) => api.get(url).set('Authorization', `Bearer ${tokens[who]}`),
  post: (url, body = {}) => api.post(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
  patch: (url, body = {}) => api.patch(url).set('Authorization', `Bearer ${tokens[who]}`).send(body),
});

async function login(empId, password) {
  const res = await api.post('/auth/login').send({ empId, password });
  assert.equal(res.status, 200, res.text);
  return res.body.token;
}

before(async () => {
  await pool.query('DROP TABLE IF EXISTS bill_events, bills, users CASCADE');
  await pool.query('DROP TYPE IF EXISTS bill_status, user_role');
  await migrate();
  await pool.query(
    "INSERT INTO users (emp_id, name, role, password_hash) VALUES ('ADM-1', 'Owner', 'admin', $1)",
    [await bcrypt.hash('admin123', 4)],
  );
  tokens.admin = await login('ADM-1', 'admin123');
});

after(() => pool.end());

test('login rejects a wrong password', async () => {
  const res = await api.post('/auth/login').send({ empId: 'ADM-1', password: 'nope' });
  assert.equal(res.status, 401);
});

test('admin creates cashier and drivers; others cannot', async () => {
  for (const [key, body] of [
    ['cashier', { role: 'cashier', empId: 'CSH-1', name: 'Ravi Cashier', password: 'cash123' }],
    ['driver', { role: 'driver', empId: 'DRV-1', name: 'Amit Driver', phone: '9876543210', password: 'drive123' }],
    ['driver2', { role: 'driver', empId: 'DRV-2', name: 'Sunil Driver', password: 'drive123' }],
  ]) {
    const res = await as('admin').post('/users', body);
    assert.equal(res.status, 201, res.text);
    ids[key] = res.body.user.id;
    tokens[key] = await login(body.empId, body.password);
  }
  const dup = await as('admin').post('/users', { role: 'driver', empId: 'drv-1x', name: 'x', password: 'abcdef' });
  assert.equal(dup.status, 201);
  const taken = await as('admin').post('/users', { role: 'driver', empId: 'DRV-1', name: 'x', password: 'abcdef' });
  assert.equal(taken.status, 409);
  const byCashier = await as('cashier').post('/users', { role: 'driver', empId: 'X', name: 'x', password: 'abcdef' });
  assert.equal(byCashier.status, 403);
});

test('cashier can list drivers only', async () => {
  const drivers = await as('cashier').get('/users?role=driver');
  assert.equal(drivers.status, 200);
  assert.ok(drivers.body.users.every((u) => u.role === 'driver'));
  assert.equal((await as('cashier').get('/users')).status, 403);
});

test('full delivery flow: counter -> driver -> customer OTP -> finalized', async () => {
  const created = await as('cashier').post('/bills', {
    billNo: 'B-1001',
    receiverName: 'Sharma Traders',
    receiverPhone: '+91 98765 43211',
    lotDetails: '20 bags cement',
  });
  assert.equal(created.status, 201, created.text);
  const bill = created.body.bill;
  ids.bill = bill.id;
  assert.equal(bill.status, 'created');
  assert.equal(bill.receiverPhone, '9876543211');
  assert.equal(bill.cashier.name, 'Ravi Cashier');
  assert.ok(bill.createdAt);

  const dupBill = await as('cashier').post('/bills', { billNo: 'B-1001', receiverName: 'x', receiverPhone: '9876543211' });
  assert.equal(dupBill.status, 409);

  // Driver cannot see or act on an unassigned bill.
  assert.equal((await as('driver').get(`/bills/${bill.id}`)).status, 403);

  const assigned = await as('cashier').post(`/bills/${bill.id}/assign`, { driverId: ids.driver });
  assert.equal(assigned.status, 200, assigned.text);
  assert.equal(assigned.body.bill.status, 'assigned');
  assert.equal(assigned.body.bill.driver.name, 'Amit Driver');

  // Driver 2 sees nothing and cannot act.
  assert.equal((await as('driver2').get('/bills')).body.bills.length, 0);
  assert.equal((await as('driver2').post(`/bills/${bill.id}/loaded`)).status, 403);

  const mine = await as('driver').get('/bills?status=assigned,loaded,left');
  assert.equal(mine.body.bills.length, 1);

  // Out of order step is refused.
  assert.equal((await as('driver').post(`/bills/${bill.id}/left`)).status, 409);

  const loaded = await as('driver').post(`/bills/${bill.id}/loaded`);
  assert.equal(loaded.status, 200, loaded.text);
  assert.ok(loaded.body.bill.loadedAt);

  // Cannot reassign once loaded.
  assert.equal((await as('cashier').post(`/bills/${bill.id}/assign`, { driverId: ids.driver2 })).status, 409);

  const left = await as('driver').post(`/bills/${bill.id}/left`);
  assert.equal(left.status, 200, left.text);
  assert.equal(left.body.bill.status, 'left');
  assert.match(left.body.testOtp, /^\d{6}$/);
  const otp = left.body.testOtp;

  const wrong = await as('driver').post(`/bills/${bill.id}/deliver`, { otp: otp === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  assert.match(wrong.body.error, /Wrong OTP, 4 attempts left/);

  const done = await as('driver').post(`/bills/${bill.id}/deliver`, { otp });
  assert.equal(done.status, 200, done.text);
  assert.equal(done.body.bill.status, 'delivered');
  assert.equal(done.body.bill.finalized, true);
  assert.ok(done.body.bill.reachedAt);
  assert.equal(typeof done.body.bill.durationMinutes, 'number');

  // Using the OTP again fails, the bill is closed.
  assert.equal((await as('driver').post(`/bills/${bill.id}/deliver`, { otp })).status, 409);

  const detail = await as('admin').get(`/bills/${bill.id}`);
  assert.deepEqual(
    detail.body.events.map((e) => e.event),
    ['created', 'assigned', 'loaded', 'left', 'otp_sent', 'otp_failed', 'delivered', 'finalized'],
  );
  assert.equal(detail.body.events.at(-1).by, 'Ravi Cashier');
});

test('OTP locks after too many wrong attempts, resend unlocks', async () => {
  const { body } = await as('cashier').post('/bills', {
    billNo: 'B-1002', receiverName: 'Gupta', receiverPhone: '9123456789', driverId: ids.driver,
  });
  const id = body.bill.id;
  assert.equal(body.bill.status, 'assigned');
  await as('driver').post(`/bills/${id}/loaded`);
  const { body: leftBody } = await as('driver').post(`/bills/${id}/left`);
  const bad = leftBody.testOtp === '999999' ? '888888' : '999999';
  for (let i = 0; i < 5; i++) await as('driver').post(`/bills/${id}/deliver`, { otp: bad });
  const locked = await as('driver').post(`/bills/${id}/deliver`, { otp: leftBody.testOtp });
  assert.equal(locked.status, 429);
  const resent = await as('driver').post(`/bills/${id}/resend-otp`);
  assert.equal(resent.status, 200);
  const ok = await as('driver').post(`/bills/${id}/deliver`, { otp: resent.body.testOtp });
  assert.equal(ok.status, 200, ok.text);
});

test('cashier can cancel an open bill but not a delivered one', async () => {
  const { body } = await as('cashier').post('/bills', { billNo: 'B-1003', receiverName: 'X', receiverPhone: '9000000001' });
  const cancelled = await as('cashier').post(`/bills/${body.bill.id}/cancel`, { reason: 'Customer called off' });
  assert.equal(cancelled.body.bill.status, 'cancelled');
  assert.equal((await as('cashier').post(`/bills/${ids.bill}/cancel`)).status, 409);
});

test('history search and filters', async () => {
  const all = await as('cashier').get('/bills');
  assert.equal(all.body.bills.length, 3);
  const search = await as('cashier').get('/bills?q=sharma');
  assert.equal(search.body.bills.length, 1);
  const delivered = await as('admin').get('/bills?status=delivered');
  assert.equal(delivered.body.bills.length, 2);
  assert.equal((await as('admin').get('/bills?status=bogus')).status, 400);
  assert.equal((await as('admin').get('/bills?from=not-a-date')).status, 400);
  assert.equal((await as('admin').get('/bills/not-a-uuid')).status, 404);
});

test('validation errors', async () => {
  const res = await as('cashier').post('/bills', { billNo: 'B-9', receiverName: 'X', receiverPhone: '12345' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /mobile number/);
});

test('disabled accounts are locked out immediately', async () => {
  const res = await as('admin').patch(`/users/${ids.driver2}`, { active: false });
  assert.equal(res.status, 200);
  assert.equal((await as('driver2').get('/bills')).status, 401);
  const assign = await as('cashier').post('/bills', {
    billNo: 'B-1004', receiverName: 'Y', receiverPhone: '9000000002', driverId: ids.driver2,
  });
  assert.equal(assign.status, 400);
  assert.equal((await as('admin').patch(`/users/${(await as('admin').get('/auth/me')).body.user.id}`, { active: false })).status, 400);
});
