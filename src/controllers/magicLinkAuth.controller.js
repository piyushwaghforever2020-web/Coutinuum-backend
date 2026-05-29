const magicLinkService = require('../services/magicLink.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * POST /auth/magic-link/verify
 * Verifies a magic link token and returns a session JWT.
 *
 * Body: { token: "<raw_token_from_email_link>" }
 *
 * On success returns:
 *   - sessionToken: JWT for subsequent authenticated requests
 *   - user: { email, role, participantId, cohortId, purpose }
 *   - redirectUrl: the frontend page the user should be sent to
 */
const verifyMagicLink = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const result = await magicLinkService.verifyMagicLink(token);

  // Build redirect URL — point to the cohort the employer bought for the employee
  let redirectUrl = '/';

  if (result.user.cohortId) {
    redirectUrl = `/cohort/?id=${result.user.cohortId}`;
  }

  return sendSuccess(res, 'Magic link verified successfully.', {
    session_token: result.sessionToken,
    user: {
      email: result.user.email,
      role: result.user.role,
      participant_id: result.user.participantId,
      cohort_id: result.user.cohortId
    },
    redirect_url: redirectUrl
  });
});

module.exports = {
  verifyMagicLink
};
