module.exports = (sequelize, DataTypes) => {
    const ContactUs = sequelize.define(
      'ContactUs',
      {
        id: {
          type: DataTypes.BIGINT,
          autoIncrement: true,
          primaryKey: true
        },
        fistName: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field : 'fist_name'
        },
        lastName: {
            type: DataTypes.STRING(150),
            allowNull: true,
            field : 'last_name',
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: true,
          unique: true,
          validate: {
            isEmail: true
          },
          field : 'email',
        },
        selectedTopic :{
            type: DataTypes.STRING(500),
            allowNull : true,
            field : 'selected_topic',
        },
        message :{
            type : DataTypes.TEXT,
            allowNull : true,
            field : 'message'
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated_at'
        },
      },
      {
        tableName: 'contact_us',
        timestamps: true
      }
    );
  
    return ContactUs;
};