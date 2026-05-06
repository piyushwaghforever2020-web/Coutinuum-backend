module.exports = (sequelize, DataTypes) => {
  const AdminSession = sequelize.define(
    'AdminSession',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      adminId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'admin_id'
      },
      tokenId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        unique: true,
        field: 'token_id'
      },
      tokenHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
        field: 'token_hash'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'expires_at'
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at'
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at'
      },
      revokedReason: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'revoked_reason'
      }
    },
    {
      tableName: 'admin_sessions',
      underscored: true,
      timestamps: true
    }
  );

  return AdminSession;
};
