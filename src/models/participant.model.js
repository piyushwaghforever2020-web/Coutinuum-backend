const {
  PAYMENT_STATUSES,
  REGISTRATION_STATUSES
} = require('../constants/app.constants');

module.exports = (sequelize, DataTypes) => {
  const Participant = sequelize.define(
    'Participant',
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
      
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      company: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      role: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      cohortId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'cohort_id',
        references: {
          model: 'cohorts',
          key: 'id'
        }
      },
      programId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'program_id',
        references: {
          model: 'programs',
          key: 'id'
        }
      },
      answers: {
        type: DataTypes.JSON,
        allowNull: true
      },
      agreeEmail: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'agree_email'
      },
      agreeSms: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'agree_sms'
      },
      employerFunded: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'employer_funded'
      },
      paymentStatus: {
        type: DataTypes.ENUM(...PAYMENT_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
        field: 'payment_status'
      },
      registrationStatus: {
        type: DataTypes.ENUM(...REGISTRATION_STATUSES),
        allowNull: false,
        defaultValue: 'incomplete',
        field: 'registration_status'
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'password_hash'
      },
      passwordGeneratedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'password_generated_at'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active'
      }
    },
    {
      tableName: 'participants',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['email', 'cohort_id']
        },
        {
          fields: ['program_id']
        }
      ]
    }
  );

  return Participant;
};
