const express = require('express');
const cohortController = require('../controllers/cohort.controller');
const validate = require('../middlewares/validate.middleware');
const cohortValidation = require('../validations/cohort.validation');
const {
  uploadCohortAssets,
  normalizeCohortMultipartBody
} = require('../middlewares/cohortUpload.middleware');


const router = express.Router();

router.get('/cohorts', validate(cohortValidation.listCohorts), cohortController.getCohorts);
// router.post('/cohorts', validate(cohortValidation.createCohort), cohortController.createCohort);

router.post(
  '/cohorts',
  uploadCohortAssets,
  normalizeCohortMultipartBody,
  validate(cohortValidation.createCohort),
  cohortController.createCohort
);
router.get('/cohorts/:id', validate(cohortValidation.cohortId), cohortController.getCohortById);
// router.put('/cohorts/:id', validate(cohortValidation.updateCohort), cohortController.updateCohort);


router.put(
  '/cohorts/:id',
  uploadCohortAssets,
  normalizeCohortMultipartBody,
  validate(cohortValidation.updateCohort),
  cohortController.updateCohort
);

router.patch(
  '/cohorts/:id/active-status',
  validate(cohortValidation.updateCohortActiveStatus),
  cohortController.updateCohortActiveStatus
);
router.delete('/cohorts/:id', validate(cohortValidation.cohortId), cohortController.deleteCohort);

module.exports = router;
