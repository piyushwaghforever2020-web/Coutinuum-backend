const cron = require('node-cron');
const { Cohort, Participant } = require('../../models');
const mailService = require('../../services/mail.service');
const { buildEmailCard, getEmailLogoAttachments } = require('../emailTemplate');

const getTomorrowDateString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const sendCohortReminders = async () => {
  const tomorrowDate = getTomorrowDateString();

  const cohorts = await Cohort.findAll({
    where: {
      isActive: true,
      startDate: tomorrowDate
    },
    attributes: ['id', 'name', 'startDate']
  });

  for (const cohort of cohorts) {
    const participants = await Participant.findAll({
      where: {
        cohortId: cohort.id,
        isActive: true
      },
      attributes: ['email']
    });

    const participantEmails = participants
      .map((p) => p.email)
      .filter(Boolean)
      .map((email) => ({ email }));

    if (!participantEmails.length) continue;

    await mailService.sendEmail({
      to: participantEmails,
      subject: `Cohort Reminder: ${cohort.name}`,
      html: buildEmailCard({
        title: 'Cohort starts tomorrow',
        greeting: 'Hello,',
        message: `${cohort.name} starts on ${new Date(cohort.startDate).toLocaleDateString()}. Please make sure to attend on time.`,
        buttonLabel: 'View Details',
        footer: 'You are receiving this because you are registered for this cohort.'
      }),
      attachments: getEmailLogoAttachments()
    });
  }
};

// runs every 15 sec (keep or change)
cron.schedule('* 10 * * * * *', async () => {
  try {
    await sendCohortReminders();
  } catch (error) {
    console.error('[cohortRemindersCron] Failed:', error.message);
  }
});

module.exports = {
  sendCohortReminders
};