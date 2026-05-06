const express = require('express');
const mailController = require('../controllers/mail.controller');
const mailValidation = require('../validations/mail.validation');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

router.post('/mail/send', mailController.sendEmail);

module.exports = router;
    