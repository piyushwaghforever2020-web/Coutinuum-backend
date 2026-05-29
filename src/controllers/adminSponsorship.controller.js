const adminSponsorshipService = require('../services/adminSponsorship.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getAllSponsorships = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.getAllSponsorships(req.query);
  return sendSuccess(res, 'Sponsorships fetched successfully.', data);
});

const getSponsorshipById = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.getSponsorshipById(req.params.id);
  return sendSuccess(res, 'Sponsorship fetched successfully.', data);
});

const updateSponsorship = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.updateSponsorship(req.params.id, req.body);
  return sendSuccess(res, 'Sponsorship updated successfully.', data);
});

const deleteSponsorship = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.deleteSponsorship(req.params.id);
  return sendSuccess(res, 'Sponsorship deleted successfully.', data);
});

const updateSponsorshipActiveStatus = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.updateSponsorshipActiveStatus(
    req.params.id,
    req.body
  );
  return sendSuccess(res, 'Sponsorship active status updated successfully.', data);
});

const markSponsorshipAsPaid = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.markSponsorshipAsPaid(req.params.id, req.admin);
  return sendSuccess(res, 'Sponsorship marked as paid successfully.', data);
});

const markSponsorshipAsUnpaid = asyncHandler(async (req, res) => {
  const data = await adminSponsorshipService.markSponsorshipAsUnpaid(req.params.id);
  return sendSuccess(res, 'Sponsorship marked as unpaid successfully.', data);
});

module.exports = {
  getAllSponsorships,
  getSponsorshipById,
  updateSponsorship,
  deleteSponsorship,
  updateSponsorshipActiveStatus,
  markSponsorshipAsPaid,
  markSponsorshipAsUnpaid
};
