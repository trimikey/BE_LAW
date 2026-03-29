const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Consultation = sequelize.define('Consultation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'ID khách hàng'
    },
    lawyer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'ID luật sư'
    },
    case_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'cases',
            key: 'id'
        },
        comment: 'ID vụ việc (nếu có)'
    },
    scheduled_at: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Thời gian đặt lịch'
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
        comment: 'Thời lượng (phút)'
    },
    consultation_type: {
        type: DataTypes.ENUM('video', 'phone', 'in_person'),
        allowNull: false,
        defaultValue: 'video',
        comment: 'Loại tư vấn'
    },
    status: {
        type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Trạng thái'
    },
    fee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'Phí tư vấn (VNĐ)'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Ghi chú'
    },
    meeting_link: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Link meeting (nếu video call)'
    },
    reminder_sent: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Đã gửi nhắc nhở 30p trước chưa'
    }
}, {
    tableName: 'consultations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['client_id'] },
        { fields: ['lawyer_id'] },
        { fields: ['scheduled_at'] },
        { fields: ['status'] }
    ]
});

module.exports = Consultation;
