const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const adminRepository = require('../repositories/admin.repository');
const adminSessionRepository = require('../repositories/adminSession.repository');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const { generateTokenId, hashToken } = require('../utils/token');

class AuthService {
  async login(payload) {
    const admin = await adminRepository.findByEmail(payload.email);

    if (!admin) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(payload.password, admin.password);

    if (!isPasswordValid) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password.');
    }

    const tokenId = generateTokenId();
    const token = jwt.sign(
      {
        sub: admin.id,
        email: admin.email
      },
      env.jwtSecret,
      {
        expiresIn: env.jwtExpiresIn,
        jwtid: tokenId
      }
    );
    const decoded = jwt.decode(token);
    const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : null;

    await adminSessionRepository.create({
      adminId: admin.id,
      tokenId,
      tokenHash: hashToken(token),
      expiresAt,
      lastUsedAt: new Date()
    });

    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        created_at: admin.createdAt
      }
    };
  }

  async logout(token, adminId) {
    const decoded = jwt.verify(token, env.jwtSecret);

    if (!decoded?.jti) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid authentication token.');
    }

    const session = await adminSessionRepository.findByTokenId(decoded.jti);

    if (!session || Number(session.adminId) !== Number(adminId)) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Active admin session not found.');
    }

    if (session.revokedAt) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Admin session has already been logged out.');
    }

    if (session.tokenHash !== hashToken(token)) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid authentication token.');
    }

    await adminSessionRepository.update(session, {
      revokedAt: new Date(),
      revokedReason: 'logout'
    });

    return {
      logged_out: true
    };
  }
}

module.exports = new AuthService();
