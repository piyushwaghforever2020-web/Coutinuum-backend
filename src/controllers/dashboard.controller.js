const dashboardService = require('../services/dashboard.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardMetrics(req.query);
  return sendSuccess(res, 'Dashboard data fetched successfully.', data);
});

const getRegistrationCompletionGraph = asyncHandler(async (req, res) => {
  const data = await dashboardService.getRegistrationCompletionGraph(req.query);
  return sendSuccess(res, 'Registration completion graph fetched successfully.', data);
});

const getPaymentStatusGraph = asyncHandler(async (req, res) => {
  const data = await dashboardService.getPaymentStatusGraph(req.query);
  return sendSuccess(res, 'Payment status graph fetched successfully.', data);
});

const getCohortFillProgressGraph = asyncHandler(async (req, res) => {
  const data = await dashboardService.getCohortFillProgressGraph(req.query);
  return sendSuccess(res, 'Cohort fill progress graph fetched successfully.', data);
});

module.exports = {
  getDashboard,
  getRegistrationCompletionGraph,
  getPaymentStatusGraph,
  getCohortFillProgressGraph
};
