const participantAuthService = require('../services/participantAuth.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const login = asyncHandler(async (req, res) => {
  const data = await participantAuthService.login(req.body);
  return sendSuccess(res, 'Participant login successful.', data);
});

const changePassword = asyncHandler(async (req, res) => {
  if (req.user.role !== 'participant' || !req.user.participantId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Participant session is required.');
  }

  const data = await participantAuthService.changePassword({
    participantId: req.user.participantId,
    ...req.body
  });
  return sendSuccess(res, 'Participant password changed successfully.', data);
});

const setPassword = asyncHandler(async (req, res) => {
  const data = await participantAuthService.setPassword(req.body);
  return sendSuccess(res, 'Password set successfully. You can now login.', data);
});

module.exports = {
  login,
  changePassword,
  setPassword
};
