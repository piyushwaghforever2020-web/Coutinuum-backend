const sponsorshipService = require('../services/sponsorship.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const createBlockSponsorship = asyncHandler(async (req, res) => {
  const data = await sponsorshipService.createBlockSponsorship(req.body);
  return sendSuccess(res, 'Sponsorship registration received successfully.', data, 201);
});

const getEmployerDashboard = asyncHandler(async (req, res) => {
  const data = await sponsorshipService.getEmployerDashboard(req.params.id, req.user);
  return sendSuccess(res, 'Sponsorship dashboard fetched successfully.', data);
});

const getEmployerSeats = asyncHandler(async (req, res) => {
  const data = await sponsorshipService.getEmployerSeats(req.params.id, req.user);
  return sendSuccess(res, 'Sponsorship seats fetched successfully.', data);
});

const assignSeat = asyncHandler(async (req, res) => {
  const data = await sponsorshipService.assignSeat(
    req.params.id,
    req.params.seat_id,
    req.body,
    req.user
  );
  return sendSuccess(res, 'Seat assigned successfully.', data);
});

const resendParticipantLogin = asyncHandler(async (req, res) => {
  const data = await sponsorshipService.resendParticipantLogin(
    req.params.id,
    req.params.seat_id,
    req.user
  );
  return sendSuccess(res, 'Participant login credentials resent successfully.', data);
});

module.exports = {
  createBlockSponsorship,
  getEmployerDashboard,
  getEmployerSeats,
  assignSeat,
  resendParticipantLogin
};
