const sendMail = require('../utils/sendMail');

class MailService {
  async sendEmail(payload) {
    return sendMail(payload);
  }
}

module.exports = new MailService();
