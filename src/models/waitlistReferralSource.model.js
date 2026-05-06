module.exports = (sequelize, DataTypes) => {
  const WaitlistReferralSource = sequelize.define(
    'WaitlistReferralSource',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      waitlistSubmissionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'waitlist_submission_id'
      },
      sourceName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'source_name'
      }
    },
    {
      tableName: 'waitlist_referral_sources',
      underscored: true,
      timestamps: false
    }
  );

  return WaitlistReferralSource;
};
