// Creates the first admin account. Every other account is created by an admin in the app.
// Usage: npm run create-admin -- <empId> <name> <password>
const bcrypt = require('bcryptjs');
const { pool, migrate } = require('../src/db');

async function main() {
  const [empId, name, password] = process.argv.slice(2);
  if (!empId || !name || !password) {
    console.error('Usage: npm run create-admin -- <empId> "<name>" <password>');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters');
    process.exit(1);
  }
  await migrate();
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (emp_id, name, role, password_hash) VALUES ($1, $2, 'admin', $3)
     ON CONFLICT (emp_id) DO NOTHING RETURNING id`,
    [empId, name, hash],
  );
  console.log(rows[0] ? `Admin ${empId} created.` : `Employee ID ${empId} already exists, nothing changed.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
