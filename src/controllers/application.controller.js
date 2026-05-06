const applicationService = require('../services/application.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HTTP_STATUS } = require('../constants/app.constants');

const submitApplication = asyncHandler(async (req, res) => {
  const data = await applicationService.submitApplication(req.body);
  return sendSuccess(res, 'Application saved successfully.', data, HTTP_STATUS.OK);
});

const createCheckoutSession = asyncHandler(async (req, res) => {
  const data = await applicationService.createCheckoutSession(req.body);
  return sendSuccess(res, 'Checkout session created successfully.', data);
});

const downloadUpcomingCohortFile = asyncHandler(async (req, res) => {
  const file = await applicationService.getUpcomingCohortFileDownload(req.body);
  return res.status(200).json({success : true});
});

module.exports = {
  submitApplication,
  createCheckoutSession,
  downloadUpcomingCohortFile
};
