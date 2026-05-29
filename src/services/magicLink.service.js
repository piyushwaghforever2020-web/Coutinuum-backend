const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const magicLinkTokenRepository = require('../repositories/magicLinkToken.repository');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const MAGIC_LINK_TOKEN_BYTES = 48;

const generateRawToken = () =>
  crypto.randomBytes(MAGIC_LINK_TOKEN_BYTES).toString('base64url');

const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(String(rawToken)).digest('hex');

class MagicLinkService {
  /**
   * Generate a magic link for a given email + purpose.
   *
   * @param {object} params
   * @param {string} params.email          - recipient email
   * @param {string} params.role           - 'participant' or 'employer'
   * @param {number|null} params.participantId
   * @param {number|null} params.employerUserId
   * @param {number|null} params.sponsorshipId
   * @param {number|null} params.cohortId
   * @param {string} params.purpose        - 'login', 'file_download', 'dashboard_access', 'set_password'
   * @param {object} [params.transaction]  - optional Sequelize transaction
   * @returns {{ magicLinkUrl: string, expiresAt: Date }}
   */
  async generateMagicLink({
    email,
    role = 'participant',
    participantId = null,
    employerUserId = null,
    sponsorshipId = null,
    cohortId = null,
    purpose = 'login',
    transaction = null
  }) {
    const rawToken = generateRawToken();
    const hashedToken = hashToken(rawToken);

    const expiresAt = new Date(
      Date.now() + env.magicLink.expiresMin * 60 * 1000
    );

    const createOptions = transaction ? { transaction } : {};

    await magicLinkTokenRepository.create(
      {
        email: String(email).trim().toLowerCase(),
        token: hashedToken,
        role,
        participantId,
        employerUserId,
        sponsorshipId,
        cohortId,
        purpose,
        expiresAt
      },
      createOptions
    );

    const frontendPath =
      purpose === 'set_password'
        ? '/auth/participant/set-password'
        : '/auth/verify';

    const magicLinkUrl = `${env.frontendUrl}${frontendPath}?token=${rawToken}`;

    return { magicLinkUrl, expiresAt };
  }

  /**
   * Verify a magic link token and return context + session JWT.
   *
   * @param {string} rawToken - the raw token from the URL query param
   * @param {object} [options]
   * @param {string|null} [options.expectedPurpose]
   * @param {string[]|null} [options.allowedPurposes]
   * @param {string|null} [options.expectedRole]
   * @returns {{ sessionToken: string, user: object }}
   */
  async verifyMagicLink(rawToken, options = {}) {
    const {
      expectedPurpose = null,
      allowedPurposes = null,
      expectedRole = null
    } = options;

    if (!rawToken || typeof rawToken !== 'string') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Magic link token is required.');
    }

    const hashedToken = hashToken(rawToken);
    const tokenRecord = await magicLinkTokenRepository.findByToken(hashedToken);

    if (!tokenRecord) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired magic link.');
    }

    if (tokenRecord.usedAt) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        'This magic link has already been used. Please request a new one.'
      );
    }

    if (new Date(tokenRecord.expiresAt) <= new Date()) {
      throw new ApiError(
        HTTP_STATUS.UNAUTHORIZED,
        'This magic link has expired. Please request a new one.'
      );
    }

    if (expectedPurpose && tokenRecord.purpose !== expectedPurpose) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'This magic link is not valid for this action.'
      );
    }

    if (
      Array.isArray(allowedPurposes) &&
      allowedPurposes.length > 0 &&
      !allowedPurposes.includes(tokenRecord.purpose)
    ) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'This magic link is not valid for this action.'
      );
    }

    if (expectedRole && tokenRecord.role !== expectedRole) {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'This magic link is not valid for this access type.'
      );
    }

    // Mark token as used (single-use)
    await magicLinkTokenRepository.markUsed(tokenRecord);

    // Issue a session JWT
    const sessionPayload = {
      email: tokenRecord.email,
      role: tokenRecord.role,
      participantId: tokenRecord.participantId
        ? Number(tokenRecord.participantId)
        : null,
      employerUserId: tokenRecord.employerUserId
        ? Number(tokenRecord.employerUserId)
        : null,
      sponsorshipId: tokenRecord.sponsorshipId
        ? Number(tokenRecord.sponsorshipId)
        : null,
      cohortId: tokenRecord.cohortId
        ? Number(tokenRecord.cohortId)
        : null,
      purpose: tokenRecord.purpose
    };

    const sessionToken = jwt.sign(sessionPayload, env.magicLink.secret, {
      expiresIn: '2h',
      subject: String(tokenRecord.email)
    });

    return {
      sessionToken,
      user: sessionPayload
    };
  }
}

module.exports = new MagicLinkService();
