const express = require('express');
const applicationRoutes = require('./application.routes');
const adminAuthRoutes = require('./adminAuth.routes');
const adminDashboardRoutes = require('./adminDashboard.routes');
const adminParticipantsRoutes = require('./adminParticipants.routes');
const adminCohortsRoutes = require('./adminCohorts.routes');
const adminPaymentsRoutes = require('./adminPayments.routes');
const adminSponsorshipRoutes = require('./adminSponsorship.routes');
const adminMailRoutes = require('./adminMail.routes');
const publicCohortsRoutes = require('./publicCohorts.routes');
const enquiryRoutes = require('./enquiry.routes');
const { authenticateAdmin } = require('../middlewares/auth.middleware');
const adminContactUsRoutes = require('./adminContactUs.routes');
const magicLinkAuthRoutes = require('./magicLinkAuth.routes');
const participantAuthRoutes = require('./participantAuth.routes');
const sponsorshipRoutes = require('./sponsorship.routes');


const router = express.Router();

router.use(applicationRoutes);
router.use(enquiryRoutes);
router.use(publicCohortsRoutes);
router.use(adminContactUsRoutes);
router.use(sponsorshipRoutes);
router.use('/auth',participantAuthRoutes);
router.use('/auth', magicLinkAuthRoutes);
router.use('/admin', adminMailRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', authenticateAdmin, adminDashboardRoutes);
router.use('/admin', authenticateAdmin, adminParticipantsRoutes);
router.use('/admin', authenticateAdmin, adminCohortsRoutes);
router.use('/admin', authenticateAdmin, adminPaymentsRoutes);
router.use('/admin', authenticateAdmin, adminSponsorshipRoutes);

module.exports = router;
