const express = require('express');
const participantAuthController = require('../controllers/participantAuth.controller');
const validate = require('../middlewares/validate.middleware');
const participantAuthValidation = require('../validations/participantAuth.validation');
const { authenticateUser } = require('../middlewares/participantAuth.middleware');

const router = express.Router();

router.post(
  '/participant/login',
  validate(participantAuthValidation.login),
  participantAuthController.login
);

router.post(
  '/participant/change-password',
  authenticateUser,
  validate(participantAuthValidation.changePassword),
  participantAuthController.changePassword
);

router.post(
  '/participant/set-password',
  validate(participantAuthValidation.setPassword),
  participantAuthController.setPassword
);

module.exports = router;
