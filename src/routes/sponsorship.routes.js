const express = require('express');
const sponsorshipController = require('../controllers/sponsorship.controller');
const validate = require('../middlewares/validate.middleware');
const sponsorshipValidation = require('../validations/sponsorship.validation');
const { authenticateUser } = require('../middlewares/participantAuth.middleware');

const router = express.Router();

router.post(
  '/sponsorships/block/register',
  validate(sponsorshipValidation.createBlockSponsorship),
  sponsorshipController.createBlockSponsorship
);

router.get(
  '/employer/sponsorships/:employerUserId',
  authenticateUser,
  validate(sponsorshipValidation.getEmployerDashboard),
  sponsorshipController.getEmployerDashboard
);

router.get(
  '/employer/sponsorships/:employerUserId/seats',
  authenticateUser,
  validate(sponsorshipValidation.getEmployerSeats),
  sponsorshipController.getEmployerSeats
);

router.post(
  '/employer/sponsorships/:employerUserId/seats/:seat_id/assign',
  authenticateUser,
  validate(sponsorshipValidation.assignSeat),
  sponsorshipController.assignSeat
);

router.post(
  '/employer/sponsorships/:employerUserId/seats/:seat_id/resend-login',
  authenticateUser,
  validate(sponsorshipValidation.resendParticipantLogin),
  sponsorshipController.resendParticipantLogin
);

router.get(
  '/employer/:employerUserId/cohorts',
  authenticateUser,
  validate(sponsorshipValidation.getAllCohortsForEmployerUser),
  sponsorshipController.getAllCohortsForEmployerUser
);

module.exports = router;
