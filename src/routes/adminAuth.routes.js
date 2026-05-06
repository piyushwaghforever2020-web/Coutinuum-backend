const express = require('express');
const adminAuthController = require('../controllers/adminAuth.controller');
const { authenticateAdmin } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { loginRateLimiter } = require('../middlewares/rateLimiter.middleware');
const authValidation = require('../validations/auth.validation');

const router = express.Router();

router.post(
  '/login',
  loginRateLimiter,
  validate(authValidation.login),
  adminAuthController.login
);
router.post('/logout', authenticateAdmin, adminAuthController.logout);

module.exports = router;
