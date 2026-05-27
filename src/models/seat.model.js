const { SEAT_STATUSES } = require('../constants/app.constants');

module.exports = (sequelize, DataTypes) => {
  const Seat = sequelize.define(
    'Seat',
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
      participantEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'participant_email'
      },
      status: {
        type: DataTypes.ENUM(...SEAT_STATUSES),
        allowNull: false,
        defaultValue: 'locked'
      },
      lockedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'locked_at'
      },
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'activated_at'
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'assigned_at'
      }
    },
    {
      tableName: 'seats',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['participant_id', 'cohort_id']
        },
        {
          fields: ['cohort_id', 'status']
        }
      ]
    }
  );

  return Seat;
};
