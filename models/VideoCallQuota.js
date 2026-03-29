const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VideoCallQuota = sequelize.define(
  'VideoCallQuota',
  {
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
      }
    },
    lawyer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    free_seconds_used: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    paid_seconds_remaining: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    tableName: 'video_call_quotas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['client_id'] },
      { fields: ['lawyer_id'] },
      { unique: true, fields: ['client_id', 'lawyer_id'], name: 'uniq_video_quota_pair' }
    ]
  }
);

module.exports = VideoCallQuota;

