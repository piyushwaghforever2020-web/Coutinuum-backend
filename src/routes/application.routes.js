const express = require('express');
const applicationController = require('../controllers/application.controller');
const validate = require('../middlewares/validate.middleware');
const applicationValidation = require('../validations/application.validation');

const router = express.Router();

router.post(
  '/application',
  validate(applicationValidation.submitApplication),
  applicationController.submitApplication
);

router.post(
  '/create-checkout-session',
  validate(applicationValidation.createCheckoutSession),
  applicationController.createCheckoutSession
);

router.post(
  '/upcoming-cohort-file/download',
  validate(applicationValidation.downloadUpcomingCohortFile),
  applicationController.downloadUpcomingCohortFile
);

module.exports = router;
