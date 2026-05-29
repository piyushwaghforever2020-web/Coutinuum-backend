module.exports = (sequelize, DataTypes) => {
  const EmployerUser = sequelize.define(
    'EmployerUser',
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
        unique: true,
        validate: {
          isEmail: true
        }
      },
      companyName: {
        type: DataTypes.STRING(150),
        allowNull: true,
        field: 'company_name'
      },
      stripeCustomerId: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'stripe_customer_id'
      }
    },
    {
      tableName: 'employer_users',
      underscored: true,
      timestamps: true
    }
  );

  return EmployerUser;
};
