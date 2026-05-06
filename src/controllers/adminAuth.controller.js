const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  return sendSuccess(res, 'Admin login successful.', data);
});

const logout = asyncHandler(async (req, res) => {
  const data = await authService.logout(req.token, req.admin.id);
  return sendSuccess(res, 'Admin logout successful.', data);
});

module.exports = {
  login,
  logout
};
