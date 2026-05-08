const enquiryService = require('../services/enquiry.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HTTP_STATUS } = require('../constants/app.constants');

const getLabEnquiries = asyncHandler(async (req, res) => {
  const data = await enquiryService.getLabEnquiries(req.query);
  return sendSuccess(res, 'Lab enquiries fetched successfully.', data);
});

const createLabEnquiry = asyncHandler(async (req, res) => {
  const data = await enquiryService.createLabEnquiry(req.body);
  return sendSuccess(res, 'Lab enquiry submitted successfully.', data, HTTP_STATUS.CREATED);
});

const getSpeakerEnquiries = asyncHandler(async (req, res) => {
  const data = await enquiryService.getSpeakerEnquiries(req.query);
  return sendSuccess(res, 'Speaker enquiries fetched successfully.', data);
});

const createSpeakerEnquiry = asyncHandler(async (req, res) => {
  const data = await enquiryService.createSpeakerEnquiry(req.body);
  return sendSuccess(res, 'Speaker enquiry submitted successfully.', data, HTTP_STATUS.CREATED);
});

const getWaitlistSubmissions = asyncHandler(async (req, res) => {
  const data = await enquiryService.getWaitlistSubmissions(req.query);
  return sendSuccess(res, 'Waitlist submissions fetched successfully.', data);
});

const createWaitlistSubmission = asyncHandler(async (req, res) => {
  const data = await enquiryService.createWaitlistSubmission(req.body);
  return sendSuccess(res, 'Waitlist submission saved successfully.', data, HTTP_STATUS.CREATED);
});

const getEmailListSubscriptions = asyncHandler(async (req, res) => {
  const data = await enquiryService.getEmailListSubscriptions(req.query);
  return sendSuccess(res, 'Email list subscriptions fetched successfully.', data);
});

const createEmailListSubscription = asyncHandler(async (req, res) => {
  const data = await enquiryService.createEmailListSubscription(req.body);
  return sendSuccess(res, 'Email list subscription saved successfully.', data, HTTP_STATUS.CREATED);
});

module.exports = {
  getLabEnquiries,
  createLabEnquiry,
  getSpeakerEnquiries,
  createSpeakerEnquiry,
  getWaitlistSubmissions,
  createWaitlistSubmission,
  getEmailListSubscriptions,
  createEmailListSubscription
};
