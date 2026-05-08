const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { HTTP_STATUS } = require('../constants/app.constants');
const ApiError = require('../utils/apiError');
const adminRepository = require('../repositories/admin.repository');
const adminSessionRepository = require('../repositories/adminSession.repository');
const { hashToken } = require('../utils/token');

const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Authentication token is required.');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtSecret);
    const tokenId = decoded?.jti;

    if (!tokenId) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid authentication token.');
    }

    const session = await adminSessionRepository.findActiveByTokenId(tokenId);

    if (!session) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Admin session is invalid or has been logged out.');
    }

    if (session.tokenHash !== hashToken(token)) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid authentication token.');
    }

    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Authentication token has expired.');
    }

    const admin = await adminRepository.findById(decoded.sub);

    if (!admin) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Admin account not found.');
    }

    await adminSessionRepository.update(session, {
      lastUsedAt: new Date()
    });

    req.admin = admin;
    req.adminSession = session;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired authentication token.'));
    }

    next(error);
  }
};

module.exports = {
  authenticateAdmin
};
