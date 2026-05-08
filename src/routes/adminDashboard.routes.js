const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const validate = require('../middlewares/validate.middleware');
const dashboardValidation = require('../validations/dashboard.validation');

const router = express.Router();

router.get(
  '/dashboard/graphs/registration-completion',
  validate(dashboardValidation.getRegistrationCompletionGraph),
  dashboardController.getRegistrationCompletionGraph
);
router.get(
  '/dashboard/graphs/payment-status',
  validate(dashboardValidation.getPaymentStatusGraph),
  dashboardController.getPaymentStatusGraph
);
router.get(
  '/dashboard/graphs/cohort-fill-progress',
  validate(dashboardValidation.getCohortFillProgressGraph),
  dashboardController.getCohortFillProgressGraph
);
router.get('/dashboard', validate(dashboardValidation.getDashboard), dashboardController.getDashboard);

module.exports = router;
