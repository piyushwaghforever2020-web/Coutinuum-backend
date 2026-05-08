module.exports = (sequelize, DataTypes) => {
  const LabEnquiry = sequelize.define(
    'LabEnquiry',
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
      },
      roleTitle: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'role_title'
      },
      company: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      urgencyNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'urgency_notes'
      }
    },
    {
      tableName: 'lab_enquiries',
      underscored: true,
      timestamps: true
    }
  );

  return LabEnquiry;
};
