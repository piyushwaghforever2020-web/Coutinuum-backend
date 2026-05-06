module.exports = (sequelize, DataTypes) => {
  const Program = sequelize.define(
    'Program',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      tableName: 'programs',
      underscored: true,
      timestamps: true
    }
  );

  return Program;
};
