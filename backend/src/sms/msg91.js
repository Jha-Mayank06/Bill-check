// MSG91 (India) provider, used once the paid account is bought.
// Needs MSG91_AUTH_KEY and an approved DLT template (MSG91_TEMPLATE_ID)
// whose OTP variable is ##otp## and bill variable is ##billno##.
const config = require('../config');

module.exports = {
  async sendOtp({ phone, otp, billNo }) {
    const { authKey, templateId } = config.msg91;
    if (!authKey || !templateId) throw new Error('MSG91_AUTH_KEY and MSG91_TEMPLATE_ID must be set');
    const res = await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST',
      headers: { authkey: authKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        short_url: '0',
        recipients: [{ mobiles: `91${phone}`, otp, billno: billNo }],
      }),
    });
    if (!res.ok) throw new Error(`MSG91 request failed with status ${res.status}`);
    return { shownInApp: false };
  },
};
