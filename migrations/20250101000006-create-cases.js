'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cases', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      lawyer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      case_type: {
        type: Sequelize.ENUM('consultation', 'contract', 'dispute', 'corporate', 'labor', 'tax', 'other'),
        allowNull: false,
        defaultValue: 'consultation'
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'reviewing', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        allowNull: false,
        defaultValue: 'medium'
      },
      estimated_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      actual_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('cases', ['client_id'], { name: 'idx_cases_client_id' });
    await queryInterface.addIndex('cases', ['lawyer_id'], { name: 'idx_cases_lawyer_id' });
    await queryInterface.addIndex('cases', ['status'], { name: 'idx_cases_status' });
    await queryInterface.addIndex('cases', ['case_type'], { name: 'idx_cases_case_type' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cases');
  }
};
