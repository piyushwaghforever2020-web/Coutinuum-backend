module.exports = (sequelize, DataTypes) => {
  const StripeCustomer = sequelize.define(
    'StripeCustomer',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: true
      },
      stripeCustomerId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: 'stripe_customer_id'
      }
    },
    {
      tableName: 'stripe_customers',
      underscored: true,
      timestamps: true
    }
  );

  return StripeCustomer;
};
