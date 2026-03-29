'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('consultations', {
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
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      case_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cases',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 60
      },
      consultation_type: {
        type: Sequelize.ENUM('video', 'phone', 'in_person'),
        allowNull: false,
        defaultValue: 'video'
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show'),
        allowNull: false,
        defaultValue: 'pending'
      },
      fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      meeting_link: {
        type: Sequelize.STRING(500),
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

    await queryInterface.addIndex('consultations', ['client_id'], { name: 'idx_consultations_client_id' });
    await queryInterface.addIndex('consultations', ['lawyer_id'], { name: 'idx_consultations_lawyer_id' });
    await queryInterface.addIndex('consultations', ['scheduled_at'], { name: 'idx_consultations_scheduled_at' });
    await queryInterface.addIndex('consultations', ['status'], { name: 'idx_consultations_status' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('consultations');
  }
};
