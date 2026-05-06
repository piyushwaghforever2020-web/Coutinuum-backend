const participantService = require('../services/participant.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getParticipants = asyncHandler(async (req, res) => {
  const data = await participantService.getParticipants(req.query);
  return sendSuccess(res, 'Participants fetched successfully.', data);
});

const getParticipantById = asyncHandler(async (req, res) => {
  const data = await participantService.getParticipantById(req.params.id);
  return sendSuccess(res, 'Participant fetched successfully.', data);
});

const updateParticipantStatus = asyncHandler(async (req, res) => {
  const data = await participantService.updateParticipantStatus(req.params.id, req.body);
  return sendSuccess(res, 'Participant status updated successfully.', data);
});

const updateParticipantActiveStatus = asyncHandler(async (req, res) => {
  const data = await participantService.updateParticipantActiveStatus(req.params.id, req.body);
  return sendSuccess(res, 'Participant active status updated successfully.', data);
});

const refundParticipantPayment = asyncHandler(async (req, res) => {
  const data = await participantService.refundParticipantPayment(req.params.id);
  return sendSuccess(res, 'Participant payment refunded successfully.', data);
});

const exportParticipants = asyncHandler(async (req, res) => {
  const { filename, csv } = await participantService.exportParticipants(req.query);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
});

module.exports = {
  getParticipants,
  getParticipantById,
  updateParticipantStatus,
  updateParticipantActiveStatus,
  refundParticipantPayment,
  exportParticipants
};
