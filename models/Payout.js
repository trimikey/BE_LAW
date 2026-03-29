const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payout = sequelize.define('Payout', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    lawyer_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    month: {
        type: DataTypes.STRING(7), // Format: 'YYYY-MM'
        allowNull: false
    },
    total_revenue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
    },
    lawyer_earning: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
    },
    bonus_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
    },
    total_payout: {
        type: DataTypes.VIRTUAL,
        get() {
            return Number(this.lawyer_earning) + Number(this.bonus_amount);
        }
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
    },
    paid_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    payment_proof: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Path to payment receipt/image'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'payouts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['lawyer_id'] },
        { fields: ['month'] },
        { fields: ['status'] }
    ]
});

module.exports = Payout;
