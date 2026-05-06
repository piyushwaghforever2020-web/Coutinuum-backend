const mailService = require('../services/mail.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const sendEmail = asyncHandler(async (req, res) => {
  const data = await mailService.sendEmail(req.body);
  return sendSuccess(res, 'Email sent successfully.', data);
});

module.exports = {
  sendEmail
};
