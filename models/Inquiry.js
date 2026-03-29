const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Inquiry = sequelize.define('Inquiry', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    full_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'contacted', 'resolved'),
        allowNull: false,
        defaultValue: 'pending'
    },
    lawyer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    lawyer_reply: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Nội dung phản hồi từ luật sư'
    }
}, {
    tableName: 'inquiries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Inquiry;
