const express = require('express');
const cohortController = require('../controllers/cohort.controller');
const validate = require('../middlewares/validate.middleware');
const cohortValidation = require('../validations/cohort.validation');

const router = express.Router();

router.get(
  '/cohorts/:id/seat-availability',
  validate(cohortValidation.cohortId),
  cohortController.getPublicCohortSeatAvailability
);

router.get('/cohorts', cohortController.getPublicCohorts);
router.get('/cohorts/:id', cohortController.getCohortById);

module.exports = router;
