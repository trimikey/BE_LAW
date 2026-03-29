const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaseInterest = sequelize.define('CaseInterest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    case_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'cases',
            key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID vụ việc'
    },
    lawyer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID luật sư quan tâm'
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Lời nhắn từ luật sư'
    },
    proposed_fee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Phí đề xuất (VNĐ)'
    },
    estimated_duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Thời gian ước tính (ngày)'
    },
    status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'withdrawn'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Trạng thái: pending, accepted, rejected, withdrawn'
    },
    client_viewed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Client đã xem chưa'
    },
    viewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian client xem'
    }
}, {
    tableName: 'case_interests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['case_id'] },
        { fields: ['lawyer_id'] },
        { fields: ['status'] },
        { 
            fields: ['case_id', 'lawyer_id'],
            unique: true,
            name: 'unique_case_lawyer_interest'
        }
    ]
});

module.exports = CaseInterest;
