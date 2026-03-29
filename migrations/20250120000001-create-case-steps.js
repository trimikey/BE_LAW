'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('case_steps', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      case_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'cases',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      step_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      step_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'blocked', 'skipped'),
        allowNull: false,
        defaultValue: 'pending'
      },
      description: {
        type: Sequelize.TEXT,
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
      due_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      client_visible: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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

    // Add indexes
    await queryInterface.addIndex('case_steps', ['case_id'], { name: 'idx_case_steps_case_id' });
    await queryInterface.addIndex('case_steps', ['status'], { name: 'idx_case_steps_status' });
    await queryInterface.addIndex('case_steps', ['step_order'], { name: 'idx_case_steps_order' });
    await queryInterface.addIndex('case_steps', ['assigned_to'], { name: 'idx_case_steps_assigned' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('case_steps');
  }
};
