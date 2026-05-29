const express = require('express');
const adminSponsorshipController = require('../controllers/adminSponsorship.controller');
const validate = require('../middlewares/validate.middleware');
const adminSponsorshipValidation = require('../validations/adminSponsorship.validation');

const router = express.Router();

router.get(
  '/sponsorships',
  validate(adminSponsorshipValidation.listSponsorships),
  adminSponsorshipController.getAllSponsorships
);

router.get(
  '/sponsorships/:id',
  validate(adminSponsorshipValidation.sponsorshipId),
  adminSponsorshipController.getSponsorshipById
);

router.patch(
  '/sponsorships/:id',
  validate(adminSponsorshipValidation.updateSponsorship),
  adminSponsorshipController.updateSponsorship
);

router.delete(
  '/sponsorships/:id',
  validate(adminSponsorshipValidation.sponsorshipId),
  adminSponsorshipController.deleteSponsorship
);

router.patch(
  '/sponsorships/:id/active-status',
  validate(adminSponsorshipValidation.updateActiveStatus),
  adminSponsorshipController.updateSponsorshipActiveStatus
);

router.post(
  '/sponsorships/:id/mark-paid',
  validate(adminSponsorshipValidation.sponsorshipId),
  adminSponsorshipController.markSponsorshipAsPaid
);

router.post(
  '/sponsorships/:id/mark-unpaid',
  validate(adminSponsorshipValidation.sponsorshipId),
  adminSponsorshipController.markSponsorshipAsUnpaid
);

module.exports = router;
