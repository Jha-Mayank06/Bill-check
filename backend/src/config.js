require('dotenv').config({ quiet: true });

const env = process.env;

function required(name, fallbackForDev) {
  const value = env[name] ?? (env.NODE_ENV !== 'production' ? fallbackForDev : undefined);
  if (value === undefined) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

module.exports = {
  port: Number(env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/billcheck'),
  jwtSecret: required('JWT_SECRET', 'dev-only-secret-change-me'),
  jwtExpiresIn: env.JWT_EXPIRES_IN || '12h',
  // "console" logs the OTP and also returns it to the app (test mode).
  // "msg91" sends a real SMS. See src/sms/index.js.
  smsProvider: env.SMS_PROVIDER || 'console',
  otpTtlMinutes: Number(env.OTP_TTL_MINUTES || 30),
  otpMaxAttempts: Number(env.OTP_MAX_ATTEMPTS || 5),
  otpMaxSends: Number(env.OTP_MAX_SENDS || 5),
  msg91: {
    authKey: env.MSG91_AUTH_KEY,
    templateId: env.MSG91_TEMPLATE_ID,
  },
};
