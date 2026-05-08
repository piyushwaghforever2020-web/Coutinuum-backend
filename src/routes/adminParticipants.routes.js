const express = require('express');
const participantController = require('../controllers/participant.controller');
const validate = require('../middlewares/validate.middleware');
const participantValidation = require('../validations/participant.validation');

const router = express.Router();

router.get(
  '/participants/export',
  validate(participantValidation.exportParticipants),
  participantController.exportParticipants
);

router.get(
  '/participants',
  validate(participantValidation.listParticipants),
  participantController.getParticipants
);

router.get(
  '/participants/:id',
  validate(participantValidation.participantId),
  participantController.getParticipantById
);

router.patch(
  '/participants/:id/status',
  validate(participantValidation.updateParticipantStatus),
  participantController.updateParticipantStatus
);

router.patch(
  '/participants/:id/active-status',
  validate(participantValidation.updateParticipantActiveStatus),
  participantController.updateParticipantActiveStatus
);

router.post(
  '/participants/:id/refund',
  validate(participantValidation.participantId),
  participantController.refundParticipantPayment
);

module.exports = router;
