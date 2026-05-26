const cohortService = require('../services/cohort.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { HTTP_STATUS } = require('../constants/app.constants');

const getPublicCohorts = asyncHandler(async (req, res) => {
  const data = await cohortService.getPublicCohorts();
  return sendSuccess(res, 'Public cohorts fetched successfully.', data);
});

const getPublicCohortSeatAvailability = asyncHandler(async (req, res) => {
  const data = await cohortService.getPublicCohortSeatAvailability(req.params.id);
  return sendSuccess(res, 'Cohort seat availability fetched successfully.', data);
});

const getCohorts = asyncHandler(async (req, res) => {
  const data = await cohortService.getCohorts(req.query);
  return sendSuccess(res, 'Cohorts fetched successfully.', data);
});

// const createCohort = asyncHandler(async (req, res) => {
//   const data = await cohortService.createCohort(req.body);
//   return sendSuccess(res, 'Cohort created successfully.', data, HTTP_STATUS.CREATED);
// });

const createCohort = asyncHandler(async (req, res) => {
     console.log("req.body",req.body)
  const data = await cohortService.createCohort(req.body);
  return sendSuccess(res, 'Cohort created successfully.', data, HTTP_STATUS.CREATED);
});


const updateCohort = asyncHandler(async (req, res) => {
  const data = await cohortService.updateCohort(req.params.id, req.body);
  return sendSuccess(res, 'Cohort updated successfully.', data);
});

const deleteCohort = asyncHandler(async (req, res) => {
  const data = await cohortService.deleteCohort(req.params.id);
  return sendSuccess(res, 'Cohort deleted successfully.', data);
});

const getCohortById = asyncHandler(async (req, res) => {
  const data = await cohortService.getCohortById(req.params.id);
  return sendSuccess(res, 'Cohort details fetched successfully.', data);
});

const updateCohortActiveStatus = asyncHandler(async (req, res) => {
  const data = await cohortService.updateCohortActiveStatus(req.params.id, req.body);
  return sendSuccess(res, 'Cohort active status updated successfully.', data);
});

module.exports = {
  getPublicCohorts,
  getPublicCohortSeatAvailability,
  getCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
  getCohortById,
  updateCohortActiveStatus
};
