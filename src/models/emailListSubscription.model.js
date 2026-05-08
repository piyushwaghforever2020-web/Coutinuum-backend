module.exports = (sequelize, DataTypes) => {
  const EmailListSubscription = sequelize.define(
    'EmailListSubscription',
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
      sendNewPodcastEpisodes: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'send_new_podcast_episodes'
      }
    },
    {
      tableName: 'email_list_subscriptions',
      underscored: true,
      timestamps: true
    }
  );

  return EmailListSubscription;
};
