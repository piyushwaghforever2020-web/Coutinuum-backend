const express = require('express');
const contactUsController = require('../controllers/contactUs.controller');
const contactUsValidation = require('../validations/contactUs.validation');
const validate = require('../middlewares/validate.middleware');
const { authenticateAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get(
  '/contact-us',
  validate(contactUsValidation.listContactUs),
  contactUsController.getContactUsList
);

router.get(
  '/contact-us/:id',
  validate(contactUsValidation.contactUsId),
  contactUsController.getContactUsById
);

router.post(
  '/contact-us',
  validate(contactUsValidation.createContactUs),
  contactUsController.createContactUs
);

router.patch(
  '/contact-us/:id',authenticateAdmin,
  validate(contactUsValidation.updateContactUs),
  contactUsController.updateContactUs
);

router.delete(
  '/contact-us/:id',authenticateAdmin,
  validate(contactUsValidation.contactUsId),
  contactUsController.deleteContactUs
);

module.exports = router;
