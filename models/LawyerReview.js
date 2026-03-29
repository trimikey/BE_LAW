const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LawyerReview = sequelize.define('LawyerReview', {
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
    },
    comment: 'ID user cua luat su duoc danh gia'
  },
  client_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'ID user cua khach hang danh gia'
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_hidden: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'lawyer_reviews',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['lawyer_id'] },
    { fields: ['client_id'] },
    { fields: ['rating'] },
    { unique: true, fields: ['lawyer_id', 'client_id'] }
  ]
});

module.exports = LawyerReview;

