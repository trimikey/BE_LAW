const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
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
        comment: 'ID người thanh toán'
    },
    case_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'cases',
            key: 'id'
        },
        comment: 'ID vụ việc (nếu thanh toán cho case)'
    },
    consultation_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'consultations',
            key: 'id'
        },
        comment: 'ID lịch tư vấn (nếu thanh toán cho consultation)'
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Số tiền (VNĐ)'
    },
    payment_type: {
        type: DataTypes.ENUM('consultation', 'case_fee', 'deposit', 'refund'),
        allowNull: false,
        comment: 'Loại thanh toán'
    },
    payment_method: {
        type: DataTypes.ENUM('bank_transfer', 'credit_card', 'e_wallet', 'cash', 'momo', 'payos'),
        allowNull: false,
        defaultValue: 'bank_transfer',
        comment: 'Phương thức thanh toán'
    },
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Trạng thái thanh toán'
    },
    transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'Mã giao dịch từ payment gateway'
    },
    payment_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày thanh toán'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Ghi chú'
    }
}, {
    tableName: 'payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['user_id'] },
        { fields: ['case_id'] },
        { fields: ['consultation_id'] },
        { fields: ['status'] },
        { fields: ['transaction_id'] }
    ]
});

module.exports = Payment;
