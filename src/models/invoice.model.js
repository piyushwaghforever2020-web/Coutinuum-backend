const { INVOICE_STATUSES } = require('../constants/app.constants');

module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define(
    'Invoice',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      seatId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true,
        field: 'seat_id'
      },
      participantId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'participant_id'
      },
      cohortId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'cohort_id'
      },
      stripeCustomerId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'stripe_customer_id'
      },
      stripeInvoiceId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'stripe_invoice_id'
      },
      stripeInvoiceNumber: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: 'stripe_invoice_number'
      },
      managerName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'manager_name'
      },
      managerEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'manager_email'
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
      status: {
        type: DataTypes.ENUM(...INVOICE_STATUSES),
        allowNull: false,
        defaultValue: 'invoice_requested'
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
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'sent_at'
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
      }
    },
    {
      tableName: 'invoices',
      underscored: true,
      timestamps: true
    }
  );

  return Invoice;
};
