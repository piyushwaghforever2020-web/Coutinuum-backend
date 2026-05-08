const { DataTypes } = require('sequelize');
const sequelize = require('../database/connection');
const adminModel = require('./admin.model');
const adminSessionModel = require('./adminSession.model');
const cohortModel = require('./cohort.model');
const participantModel = require('./participant.model');
const paymentModel = require('./payment.model');
const labEnquiryModel = require('./labEnquiry.model');
const labEnquiryCohortInterestModel = require('./labEnquiryCohortInterest.model');
const speakerEnquiryModel = require('./speakerEnquiry.model');
const waitlistSubmissionModel = require('./waitlistSubmission.model');
const waitlistReferralSourceModel = require('./waitlistReferralSource.model');
const emailListSubscriptionModel = require('./emailListSubscription.model');
const contacUsModel = require('./contacUs.model');
const programModel = require('./program.model');
const cohortProgramModel = require('./cohortProgram.model');

const Admin = adminModel(sequelize, DataTypes);
const AdminSession = adminSessionModel(sequelize, DataTypes);
const Cohort = cohortModel(sequelize, DataTypes);
const Participant = participantModel(sequelize, DataTypes);
const Payment = paymentModel(sequelize, DataTypes);
const LabEnquiry = labEnquiryModel(sequelize, DataTypes);
const LabEnquiryCohortInterest = labEnquiryCohortInterestModel(sequelize, DataTypes);
const SpeakerEnquiry = speakerEnquiryModel(sequelize, DataTypes);
const WaitlistSubmission = waitlistSubmissionModel(sequelize, DataTypes);
const WaitlistReferralSource = waitlistReferralSourceModel(sequelize, DataTypes);
const EmailListSubscription = emailListSubscriptionModel(sequelize, DataTypes);
const ContactUs = contacUsModel(sequelize, DataTypes);
const Program = programModel(sequelize, DataTypes);
const CohortProgram = cohortProgramModel(sequelize, DataTypes);

Admin.hasMany(AdminSession, {
  foreignKey: 'adminId',
  as: 'sessions'
});

AdminSession.belongsTo(Admin, {
  foreignKey: 'adminId',
  as: 'admin'
});

Cohort.hasMany(Participant, {
  foreignKey: 'cohortId',
  as: 'participants'
});

Participant.belongsTo(Cohort, {
  foreignKey: 'cohortId',
  as: 'cohort'
});

Participant.belongsTo(Program, {
  foreignKey: 'programId',
  as: 'program'
});

Program.hasMany(Participant, {
  foreignKey: 'programId',
  as: 'participants'
});

Cohort.belongsToMany(Program, {
  through: CohortProgram,
  foreignKey: 'cohortId',
  otherKey: 'programId',
  as: 'programs'
});

Program.belongsToMany(Cohort, {
  through: CohortProgram,
  foreignKey: 'programId',
  otherKey: 'cohortId',
  as: 'cohorts'
});

Participant.hasMany(Payment, {
  foreignKey: 'participantId',
  as: 'payments'
});

Payment.belongsTo(Participant, {
  foreignKey: 'participantId',
  as: 'participant'
});

Cohort.hasMany(Payment, {
  foreignKey: 'cohortId',
  as: 'payments'
});

Payment.belongsTo(Cohort, {
  foreignKey: 'cohortId',
  as: 'cohort'
});

LabEnquiry.hasMany(LabEnquiryCohortInterest, {
  foreignKey: 'labEnquiryId',
  as: 'cohortInterests'
});

LabEnquiryCohortInterest.belongsTo(LabEnquiry, {
  foreignKey: 'labEnquiryId',
  as: 'labEnquiry'
});

WaitlistSubmission.hasMany(WaitlistReferralSource, {
  foreignKey: 'waitlistSubmissionId',
  as: 'referralSources'
});

WaitlistReferralSource.belongsTo(WaitlistSubmission, {
  foreignKey: 'waitlistSubmissionId',
  as: 'waitlistSubmission'
});

module.exports = {
  sequelize,
  Admin,
  AdminSession,
  Cohort,
  Participant,
  Payment,
  LabEnquiry,
  LabEnquiryCohortInterest,
  SpeakerEnquiry,
  WaitlistSubmission,
  WaitlistReferralSource,
  EmailListSubscription,
  ContactUs,
  Program,
  CohortProgram
};
