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
const employerUserModel = require('./employerUser.model');
const sponsorshipModel = require('./sponsorship.model');
const programModel = require('./program.model');
const cohortProgramModel = require('./cohortProgram.model');
const seatModel = require('./seat.model');
const invoiceModel = require('./invoice.model');
const stripeCustomerModel = require('./stripeCustomer.model');
const magicLinkTokenModel = require('./magicLinkToken.model');

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
const EmployerUser = employerUserModel(sequelize, DataTypes);
const Sponsorship = sponsorshipModel(sequelize, DataTypes);
const Program = programModel(sequelize, DataTypes);
const CohortProgram = cohortProgramModel(sequelize, DataTypes);
const Seat = seatModel(sequelize, DataTypes);
const Invoice = invoiceModel(sequelize, DataTypes);
const StripeCustomer = stripeCustomerModel(sequelize, DataTypes);
const MagicLinkToken = magicLinkTokenModel(sequelize, DataTypes);

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

//Define to get all cohorts for an employer user
EmployerUser.belongsToMany(Cohort, {
  through: Sponsorship,
  foreignKey: 'employerUserId',
  otherKey: 'cohortId',
  as: 'cohorts'
});

Program.belongsToMany(Cohort, {
  through: CohortProgram,
  foreignKey: 'programId',
  otherKey: 'cohortId',
  as: 'cohorts'
});

EmployerUser.hasMany(Sponsorship, {
  foreignKey: 'employerUserId',
  as: 'sponsorships'
});

Sponsorship.belongsTo(EmployerUser, {
  foreignKey: 'employerUserId',
  as: 'employer'
});

EmployerUser.hasMany(Invoice, {
  foreignKey: 'employerUserId',
  as: 'invoices'
});

Cohort.hasMany(Sponsorship, {
  foreignKey: 'cohortId',
  as: 'sponsorships'
});

Sponsorship.belongsTo(Cohort, {
  foreignKey: 'cohortId',
  as: 'cohort'
});

Program.hasMany(Sponsorship, {
  foreignKey: 'programId',
  as: 'sponsorships'
});

Sponsorship.belongsTo(Program, {
  foreignKey: 'programId',
  as: 'program'
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

Participant.hasOne(Seat, {
  foreignKey: 'participantId',
  as: 'seat'
});

Seat.belongsTo(Participant, {
  foreignKey: 'participantId',
  as: 'participant'
});

Cohort.hasMany(Seat, {
  foreignKey: 'cohortId',
  as: 'seats'
});

Seat.belongsTo(Cohort, {
  foreignKey: 'cohortId',
  as: 'cohort'
});

Sponsorship.hasMany(Seat, {
  foreignKey: 'sponsorshipId',
  as: 'seats'
});

Seat.belongsTo(Sponsorship, {
  foreignKey: 'sponsorshipId',
  as: 'sponsorship'
});

Seat.hasOne(Invoice, {
  foreignKey: 'seatId',
  as: 'invoice'
});

Invoice.belongsTo(Seat, {
  foreignKey: 'seatId',
  as: 'seat'
});

Invoice.belongsTo(Participant, {
  foreignKey: 'participantId',
  as: 'participant'
});

Invoice.belongsTo(Cohort, {
  foreignKey: 'cohortId',
  as: 'cohort'
});

Invoice.belongsTo(EmployerUser, {
  foreignKey: 'employerUserId',
  as: 'employer'
});

Sponsorship.hasOne(Invoice, {
  foreignKey: 'sponsorshipId',
  as: 'invoice'
});

Invoice.belongsTo(Sponsorship, {
  foreignKey: 'sponsorshipId',
  as: 'sponsorship'
});

Payment.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice'
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

Participant.hasMany(MagicLinkToken, {
  foreignKey: 'participantId',
  as: 'magicLinkTokens'
});

MagicLinkToken.belongsTo(Participant, {
  foreignKey: 'participantId',
  as: 'participant'
});

EmployerUser.hasMany(MagicLinkToken, {
  foreignKey: 'employerUserId',
  as: 'magicLinkTokens'
});

MagicLinkToken.belongsTo(EmployerUser, {
  foreignKey: 'employerUserId',
  as: 'employer'
});

MagicLinkToken.belongsTo(Cohort, {
  foreignKey: 'cohortId',
  as: 'cohort'
});

Sponsorship.hasMany(MagicLinkToken, {
  foreignKey: 'sponsorshipId',
  as: 'magicLinkTokens'
});

MagicLinkToken.belongsTo(Sponsorship, {
  foreignKey: 'sponsorshipId',
  as: 'sponsorship'
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
  EmployerUser,
  Sponsorship,
  Program,
  CohortProgram,
  Seat,
  Invoice,
  StripeCustomer,
  MagicLinkToken
};
