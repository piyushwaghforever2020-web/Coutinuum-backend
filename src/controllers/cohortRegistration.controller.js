const employerFundedRegistrationService = require('../services/employerFundedRegistration.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HTTP_STATUS } = require('../constants/app.constants');

const registerCohort = asyncHandler(async (req, res) => {
  const data = await employerFundedRegistrationService.registerCohort(req.body);
  return sendSuccess(res, 'Cohort registration processed successfully.', data, HTTP_STATUS.CREATED);
});

module.exports = {
  registerCohort
};
