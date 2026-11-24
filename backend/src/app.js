const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { router: authRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const billsRouter = require('./routes/bills');
const { HttpError } = require('./errors');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/bills', billsRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards errors thrown in async handlers here.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  // Postgres: invalid date or number in a filter.
  if (['22007', '22008', '22P02'].includes(err.code)) return res.status(400).json({ error: 'Invalid value in request' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
