// Test-mode provider: no SMS is sent. The OTP is logged on the server and
// returned to the app so it can be shown on screen.
module.exports = {
  async sendOtp({ phone, otp, billNo }) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[sms:console] OTP ${otp} for bill ${billNo} -> ${phone}`);
    }
    return { shownInApp: true };
  },
};
