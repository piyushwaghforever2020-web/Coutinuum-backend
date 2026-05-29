const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { HTTP_STATUS } = require('../constants/app.constants');
const ApiError = require('../utils/apiError');

/**
 * Middleware that authenticates participants/employers using the session JWT
 * issued after magic link verification.
 *
 * Attaches `req.user` with { email, role, participantId, employerUserId, sponsorshipId, cohortId, purpose }.
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        'Authentication token is required.'
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.magicLink.secret);

    req.user = {
      email: decoded.email,
      role: decoded.role,
      participantId: decoded.participantId || null,
      employerUserId: decoded.employerUserId || null,
      sponsorshipId: decoded.sponsorshipId || null,
      cohortId: decoded.cohortId || null,
      purpose: decoded.purpose || null
    };

    next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return next(
        new ApiError(
          HTTP_STATUS.UNAUTHORIZED,
          'Invalid or expired session. Please log in again via your magic link.'
        )
      );
    }

    next(error);
  }
};

module.exports = {
  authenticateUser
};
