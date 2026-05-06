const contactUsService = require('../services/contactUs.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HTTP_STATUS } = require('../constants/app.constants');

const getContactUsList = asyncHandler(async (req, res) => {
  const data = await contactUsService.getContactUsList(req.query);
  return sendSuccess(res, 'Contact submissions fetched successfully.', data);
});

const getContactUsById = asyncHandler(async (req, res) => {
  const data = await contactUsService.getContactUsById(req.params.id);
  return sendSuccess(res, 'Contact submission fetched successfully.', data);
});

const createContactUs = asyncHandler(async (req, res) => {
  const data = await contactUsService.createContactUs(req.body);
  return sendSuccess(res, 'Contact submission created successfully.', data, HTTP_STATUS.CREATED);
});

const updateContactUs = asyncHandler(async (req, res) => {
  const data = await contactUsService.updateContactUs(req.params.id, req.body);
  return sendSuccess(res, 'Contact submission updated successfully.', data);
});

const deleteContactUs = asyncHandler(async (req, res) => {
  const data = await contactUsService.deleteContactUs(req.params.id);
  return sendSuccess(res, 'Contact submission deleted successfully.', data);
});

module.exports = {
  getContactUsList,
  getContactUsById,
  createContactUs,
  updateContactUs,
  deleteContactUs
};
