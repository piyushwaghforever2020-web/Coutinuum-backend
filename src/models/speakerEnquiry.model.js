module.exports = (sequelize, DataTypes) => {
  const SpeakerEnquiry = sequelize.define(
    'SpeakerEnquiry',
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
      organization: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      eventDateOrTimeframe: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: 'event_date_or_timeframe'
      },
      eventType: {
        type: DataTypes.ENUM('keynote', 'panel', 'fireside_chat', 'executive_session', 'other'),
        allowNull: false,
        field: 'event_type'
      },
      audienceSize: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'audience_size'
      },
      winDescription: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'win_description'
      }
    },
    {
      tableName: 'speaker_enquiries',
      underscored: true,
      timestamps: true
    }
  );

  return SpeakerEnquiry;
};
