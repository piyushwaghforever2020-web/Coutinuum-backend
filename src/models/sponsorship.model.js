const { ENUM } = require('sequelize');
const { SPONSORSHIP_STATUSES , SPONSERSHIP_CATEGORY} = require('../constants/app.constants');

module.exports = (sequelize, DataTypes) => {
  const Sponsorship = sequelize.define(
    'Sponsorship',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      employerUserId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'employer_user_id'
      },
      cohortId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'cohort_id'
      },
      programId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'program_id'
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'invoice_requested',
        validate: {
          isIn: [SPONSORSHIP_STATUSES]
        }
      },
      totalSeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'total_seats'
      },
      usedSeats: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'used_seats'
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'usd'
      },
      stripeCustomerId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'stripe_customer_id'
      },
      stripeInvoiceId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: 'stripe_invoice_id'
      },
      invoiceId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'invoice_id'
      },
      hostedInvoiceUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'hosted_invoice_url'
      },
      invoicePdfUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'invoice_pdf_url'
      },
      invoiceDueAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'invoice_due_at'
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'paid_at'
      },
      stripeEventId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'stripe_event_id'
      },
      sponsershipCategory:{
        type : DataTypes.ENUM(...SPONSERSHIP_CATEGORY),
        allowNull : true,
        field : 'sponsership_category'
      }
    },
    {
      tableName: 'sponsorships',
      underscored: true,
      timestamps: true
    }
  );

  return Sponsorship;
};
