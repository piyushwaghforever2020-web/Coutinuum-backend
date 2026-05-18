
const { sequelize } = require('../models');
const enquiryRepository = require('../repositories/enquiry.repository');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const sendMail = require('../utils/sendMail');
const { buildEmailCard, getEmailLogoAttachments, escapeHtml } = require('../utils/emailTemplate');

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const mapLabEnquiry = (enquiry, interests) => ({
  id: enquiry.id,
  name: enquiry.name,
  email: enquiry.email,
  role_title: enquiry.roleTitle,
  company: enquiry.company,
  urgency_notes: enquiry.urgencyNotes,
  cohort_interests: interests.map((item) => item.interestName),
  created_at: enquiry.createdAt,
  updated_at: enquiry.updatedAt
});

const mapSpeakerEnquiry = (enquiry) => ({
  id: enquiry.id,
  name: enquiry.name,
  email: enquiry.email,
  organization: enquiry.organization,
  event_date_or_timeframe: enquiry.eventDateOrTimeframe,
  event_type: enquiry.eventType,
  audience_size: enquiry.audienceSize,
  win_description: enquiry.winDescription,
  created_at: enquiry.createdAt,
  updated_at: enquiry.updatedAt
});

const mapWaitlistSubmission = (submission, sources) => ({
  id: submission.id,
  name: submission.name,
  email: submission.email,
  referral_sources: sources.map((item) => item.sourceName),
  created_at: submission.createdAt,
  updated_at: submission.updatedAt
});

const mapEmailListSubscription = (subscription) => ({
  id: subscription.id,
  name: subscription.name,
  email: subscription.email,
  send_new_podcast_episodes: Boolean(subscription.sendNewPodcastEpisodes),
  created_at: subscription.createdAt,
  updated_at: subscription.updatedAt
});

class EnquiryService {
  async getLabEnquiries(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await enquiryRepository.findLabEnquiries({
      search: query.search,
      limit,
      offset
    });

    return {
      items: rows.map((enquiry) => mapLabEnquiry(enquiry, enquiry.cohortInterests || [])),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async createLabEnquiry(payload) {
    return sequelize.transaction(async (transaction) => {
      const enquiry = await enquiryRepository.createLabEnquiry(
        {
          name: payload.name,
          email: normalizeEmail(payload.email),
          roleTitle: payload.role_title || null,
          company: payload.company || null,
          urgencyNotes: payload.urgency_notes || null
        },
        { transaction }
      );

      const interests = await enquiryRepository.createLabEnquiryInterests(
        (payload.cohort_interests || []).map((interestName) => ({
          labEnquiryId: enquiry.id,
          interestName
        })),
        { transaction }
      );

      return mapLabEnquiry(enquiry, interests);
    });
  }

  async getSpeakerEnquiries(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await enquiryRepository.findSpeakerEnquiries({
      search: query.search,
      limit,
      offset
    });

    return {
      items: rows.map(mapSpeakerEnquiry),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async createSpeakerEnquiry(payload) {
    const enquiry = await enquiryRepository.createSpeakerEnquiry({
      name: payload.name,
      email: normalizeEmail(payload.email),
      organization: payload.organization,
      eventDateOrTimeframe: payload.event_date_or_timeframe,
      eventType: payload.event_type,
      audienceSize: payload.audience_size,
      winDescription: payload.win_description
    });

    return mapSpeakerEnquiry(enquiry);
  }

  async getWaitlistSubmissions(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await enquiryRepository.findWaitlistSubmissions({
      search: query.search,
      limit,
      offset
    });

    return {
      items: rows.map((submission) =>
        mapWaitlistSubmission(submission, submission.referralSources || [])
      ),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async createWaitlistSubmission(payload) {
    return sequelize.transaction(async (transaction) => {
      const submission = await enquiryRepository.createWaitlistSubmission(
        {
          name: payload.name,
          email: normalizeEmail(payload.email)
        },
        { transaction }
      );

      const sources = await enquiryRepository.createWaitlistReferralSources(
        (payload.referral_sources || []).map((sourceName) => ({
          waitlistSubmissionId: submission.id,
          sourceName
        })),
        { transaction }
      );

      return mapWaitlistSubmission(submission, sources);
    });
  }

  async getEmailListSubscriptions(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await enquiryRepository.findEmailListSubscriptions({
      search: query.search,
      limit,
      offset
    });

    return {
      items: rows.map(mapEmailListSubscription),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async createEmailListSubscription(payload) {
    const subscription = await enquiryRepository.createEmailListSubscription({
      name: payload.name,
      email: normalizeEmail(payload.email),
      sendNewPodcastEpisodes: Boolean(payload.send_new_podcast_episodes)
    });

    console.log('subscription:', subscription);
    //send welcome email to new subscriber
   await sendMail({
     to: [{ email: subscription.email, name: subscription.name }],
     subject: "Welcome to Continuum Transformation",
     html: buildEmailCard({
       title: "Welcome to Continuum Transformation",
       greeting: `Hi ${escapeHtml(subscription.name || "there")},`,
       messageHtml: ` Thank you for joining our email list 🎉<br /><br /> You’ll now receive: <ul style="padding-left:18px;margin:10px 0;"> <li>Leadership insights and tips</li> <li>New podcast episode updates</li> <li>Tools and resources from Continuum Transformation</li> </ul> We’re excited to have you with us. `,
       buttonLabel: "Visit Website",
       buttonUrl: process.env.FRONTEND_URL || 'https://continuumtransformation.com',
       footer: "No spam. Unsubscribe anytime.",
       iconType: "success",
     }),
     attachments: getEmailLogoAttachments(),
   });

    return mapEmailListSubscription(subscription);
  }
}

module.exports = new EnquiryService();
