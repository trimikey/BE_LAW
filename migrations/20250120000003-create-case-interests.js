'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('case_interests', {
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
      lawyer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      proposed_fee: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },
      estimated_duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('pending', 'accepted', 'rejected', 'withdrawn'),
        allowNull: false,
        defaultValue: 'pending'
      },
      client_viewed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      viewed_at: {
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

    // Add indexes
    await queryInterface.addIndex('case_interests', ['case_id'], { name: 'idx_case_interests_case_id' });
    await queryInterface.addIndex('case_interests', ['lawyer_id'], { name: 'idx_case_interests_lawyer_id' });
    await queryInterface.addIndex('case_interests', ['status'], { name: 'idx_case_interests_status' });
    
    // Add unique constraint: một lawyer chỉ có thể quan tâm một case một lần
    await queryInterface.addIndex('case_interests', ['case_id', 'lawyer_id'], {
      unique: true,
      name: 'unique_case_lawyer_interest'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('case_interests');
  }
};
