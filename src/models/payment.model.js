const { PAYMENT_STATUSES } = require('../constants/app.constants');

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
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
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM(...PAYMENT_STATUSES),
        allowNull: false,
        defaultValue: 'pending'
      },
      transactionId: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'transaction_id'
      },
      stripeCheckoutSessionId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: 'stripe_checkout_session_id'
      },
      stripePaymentIntentId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        field: 'stripe_payment_intent_id'
      },
      checkoutUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'checkout_url'
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at'
      }
    },
    {
      tableName: 'payments',
      underscored: true,
      timestamps: true
    }
  );

  return Payment;
};
