const express = require('express');
const applicationController = require('../controllers/application.controller');
const cohortRegistrationController = require('../controllers/cohortRegistration.controller');
const validate = require('../middlewares/validate.middleware');
const applicationValidation = require('../validations/application.validation');
const cohortRegistrationValidation = require('../validations/cohortRegistration.validation');

const router = express.Router();

router.post(
  '/application',
  validate(applicationValidation.submitApplication),
  applicationController.submitApplication
);

router.post(
  '/applications/cohort/register',
  validate(cohortRegistrationValidation.registerCohort),
  cohortRegistrationController.registerCohort
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
