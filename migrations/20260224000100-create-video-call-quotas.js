'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('video_call_quotas', {
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
      free_seconds_used: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      paid_seconds_remaining: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    await queryInterface.addIndex('video_call_quotas', ['client_id'], { name: 'idx_video_quota_client_id' });
    await queryInterface.addIndex('video_call_quotas', ['lawyer_id'], { name: 'idx_video_quota_lawyer_id' });
    await queryInterface.addIndex('video_call_quotas', ['client_id', 'lawyer_id'], {
      name: 'uniq_video_quota_pair',
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('video_call_quotas');
  }
};

