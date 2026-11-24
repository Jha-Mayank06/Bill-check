// SMS provider interface. Every provider exposes:
//   sendOtp({ phone, otp, billNo }) -> Promise<{ shownInApp: boolean }>
// "shownInApp" means the OTP is returned to the app for display (test mode only).
const config = require('../config');

const providers = {
  console: require('./console'),
  msg91: require('./msg91'),
};

function getSmsProvider() {
  const provider = providers[config.smsProvider];
  if (!provider) throw new Error(`Unknown SMS_PROVIDER "${config.smsProvider}"`);
  return provider;
}

module.exports = { getSmsProvider };
