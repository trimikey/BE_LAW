const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PasswordReset = sequelize.define('PasswordReset', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    token: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Token hết hạn sau 1 giờ'
    },
    used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Token đã được sử dụng chưa'
    }
}, {
    tableName: 'password_resets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        {
            fields: ['token']
        },
        {
            fields: ['user_id']
        }
    ]
});

module.exports = PasswordReset;
