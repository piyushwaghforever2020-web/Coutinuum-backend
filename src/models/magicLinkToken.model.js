const { MAGIC_LINK_ROLES, MAGIC_LINK_PURPOSES } = require('../constants/app.constants');

module.exports = (sequelize, DataTypes) => {
  const MagicLinkToken = sequelize.define(
    'MagicLinkToken',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      token: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true
      },
      role: {
        type: DataTypes.ENUM(...MAGIC_LINK_ROLES),
        allowNull: false,
        defaultValue: 'participant'
      },
      participantId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'participant_id',
        references: {
          model: 'participants',
          key: 'id'
        }
      },
      cohortId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'cohort_id',
        references: {
          model: 'cohorts',
          key: 'id'
        }
      },
      purpose: {
        type: DataTypes.ENUM(...MAGIC_LINK_PURPOSES),
        allowNull: false,
        defaultValue: 'login'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
      },
      usedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'used_at'
      }
    },
    {
      tableName: 'magic_link_tokens',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          fields: ['email']
        },
        {
          fields: ['expires_at']
        },
        {
          fields: ['participant_id']
        }
      ]
    }
  );

  return MagicLinkToken;
};
