module.exports = (sequelize, DataTypes) => {
  const WaitlistSubmission = sequelize.define(
    'WaitlistSubmission',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true
        }
      }
    },
    {
      tableName: 'waitlist_submissions',
      underscored: true,
      timestamps: true
    }
  );

  return WaitlistSubmission;
};
