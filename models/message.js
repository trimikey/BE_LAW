const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'ID người gửi'
    },
    receiver_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'ID người nhận'
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Nội dung tin nhắn'
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Trạng thái đã xem'
    },
    type: {
        type: DataTypes.ENUM('text', 'image', 'file'),
        defaultValue: 'text',
        comment: 'Loại tin nhắn'
    }
}, {
    tableName: 'messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['sender_id'] },
        { fields: ['receiver_id'] },
        { fields: ['created_at'] }
    ]
});

module.exports = Message;
