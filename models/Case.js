const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Case = sequelize.define('Case', {
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
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'ID luật sư (null nếu chưa được gán)'
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Tiêu đề vụ việc'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả vụ việc'
    },
    case_type: {
        type: DataTypes.ENUM('consultation', 'contract', 'dispute', 'corporate', 'labor', 'tax', 'tax_transfer', 'business', 'other'),
        allowNull: false,
        defaultValue: 'consultation',
        comment: 'Loại vụ việc'
    },
    status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'reviewing', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Trạng thái vụ việc'
    },
    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium',
        comment: 'Mức độ ưu tiên'
    },
    estimated_fee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Phí ước tính (VNĐ)'
    },
    actual_fee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Phí thực tế (VNĐ)'
    },
    started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày bắt đầu'
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày hoàn thành'
    },
    intake_data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Dữ liệu câu trả lời Intake'
    },
    payment_mode: {
        type: DataTypes.ENUM('step_by_step', 'lump_sum'),
        allowNull: false,
        defaultValue: 'step_by_step',
        comment: 'Phương thức thanh toán (theo giai đoạn hoặc trả một lần)'
    },
    archived_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày lưu trữ (sẽ xóa sau 7 ngày)'
    }
}, {
    tableName: 'cases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['client_id'] },
        { fields: ['lawyer_id'] },
        { fields: ['status'] },
        { fields: ['case_type'] }
    ]
});

module.exports = Case;
