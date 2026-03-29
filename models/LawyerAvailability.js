const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LawyerAvailability = sequelize.define('LawyerAvailability', {
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
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('available', 'booked', 'cancelled', 'missed'),
        allowNull: false,
        defaultValue: 'available'
    },
    consultation_type: {
        type: DataTypes.ENUM('video', 'phone', 'in_person'),
        allowNull: false,
        defaultValue: 'video'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    booked_by_client_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    booked_consultation_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'consultations',
            key: 'id'
        }
    }
}, {
    tableName: 'lawyer_availabilities',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['lawyer_id'] },
        { fields: ['status'] },
        { fields: ['start_time'] }
    ]
});

module.exports = LawyerAvailability;

