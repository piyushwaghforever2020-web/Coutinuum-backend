const express = require('express');
const magicLinkAuthController = require('../controllers/magicLinkAuth.controller');
const validate = require('../middlewares/validate.middleware');
const magicLinkAuthValidation = require('../validations/magicLinkAuth.validation');

const router = express.Router();

router.post(
  '/magic-link/verify',
  validate(magicLinkAuthValidation.verifyMagicLink),
  magicLinkAuthController.verifyMagicLink
);

module.exports = router;
