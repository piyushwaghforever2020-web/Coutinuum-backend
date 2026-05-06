module.exports = (sequelize, DataTypes) => {
  const LabEnquiryCohortInterest = sequelize.define(
    'LabEnquiryCohortInterest',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      labEnquiryId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'lab_enquiry_id'
      },
      interestName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'interest_name'
      }
    },
    {
      tableName: 'lab_enquiry_cohort_interests',
      underscored: true,
      timestamps: false
    }
  );

  return LabEnquiryCohortInterest;
};
