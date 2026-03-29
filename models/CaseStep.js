const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CaseStep = sequelize.define('CaseStep', {
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
    step_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Tên bước (ví dụ: Intake, Review, Submission, etc.)'
    },
    step_order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Thứ tự bước (1, 2, 3...)'
    },
    status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'blocked', 'skipped'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Trạng thái bước'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả bước'
    },
    started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian bắt đầu'
    },
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian hoàn thành'
    },
    due_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Hạn chót'
    },
    assigned_to: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'Người được gán (lawyer hoặc admin)'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Ghi chú nội bộ'
    },
    client_response: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Phản hồi từ khách hàng'
    },
    client_data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Dữ liệu phản hồi chi tiết từ khách hàng'
    },
    client_visible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Client có thể xem bước này không'
    },
    fee_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Số tiền thanh toán cho bước này'
    },
    fee_change_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Số lần thay đổi phí giai đoạn'
    },
    payment_status: {
        type: DataTypes.ENUM('unpaid', 'paid'),
        allowNull: false,
        defaultValue: 'unpaid',
        comment: 'Trạng thái thanh toán của giai đoạn'
    }
}, {
    tableName: 'case_steps',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['case_id'] },
        { fields: ['status'] },
        { fields: ['step_order'] },
        { fields: ['assigned_to'] }
    ]
});

module.exports = CaseStep;
