const { COHORT_STATUSES , FINAL_COHORT_STATUSES} = require('../constants/app.constants');


module.exports = (sequelize, DataTypes) => {
  const Cohort = sequelize.define(
    'Cohort',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      startDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'start_date'
      },
      endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'end_date'
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      seatLimit: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'seat_limit',
        validate: {
          min: 1
        }
      },
      seatsFilled: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'seats_filled'
      },
      status: {
        type: DataTypes.ENUM(...COHORT_STATUSES),
        allowNull: false,
        defaultValue: 'active'
      },
      syncStatus:{
        type: DataTypes.ENUM(...FINAL_COHORT_STATUSES),
        allowNull: false,
        defaultValue: 'active',
        field: 'sync_status' 
      },
      refundPolicy: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'refund_policy'
      },
      refundDeferralPolicy: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'refund_deferral_policy'
      },
      timeCommitment: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'time_commitment'
      },
      programOverview: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: 'program_overview'
      },
      isDraft: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_draft'
      },
      leaveWith: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'leave_with'
      },
      format: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: 'format'
      },
      liveSessionsText: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'live_sessions_text'
      },
      workshopsText: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'workshops_text'
      },
      cohortSizeText: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'cohort_size_text'
      },
      investmentTiers: {
        type: DataTypes.JSON,
        allowNull: true,
        field: 'investment_tiers'
      },
      scarcityText: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'scarcity_text'
      },
      displayPrice: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'display_price'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
      },
      hasMultiProgram: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'has_multi_program'
      }
    },
    {
      tableName: 'cohorts',
      underscored: true,
      timestamps: true,
      paranoid: true,
      deletedAt: 'deleted_at'
    }
  );

  return Cohort;
};
