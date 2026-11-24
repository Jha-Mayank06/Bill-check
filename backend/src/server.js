const app = require('./app');
const config = require('./config');
const { migrate } = require('./db');

migrate()
  .then(() => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`Bill Check API listening on port ${config.port} (SMS provider: ${config.smsProvider})`);
    });
  })
  .catch((err) => {
    console.error('Could not start:', err.message);
    process.exit(1);
  });
