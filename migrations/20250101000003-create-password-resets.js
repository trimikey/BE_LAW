'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_resets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Token hết hạn sau 1 giờ'
      },
      used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Token đã được sử dụng chưa'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Tạo indexes
    await queryInterface.addIndex('password_resets', ['token'], { name: 'idx_token' });
    await queryInterface.addIndex('password_resets', ['user_id'], { name: 'idx_user_id' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('password_resets');
  }
};
