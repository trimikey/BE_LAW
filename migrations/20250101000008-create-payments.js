'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
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
      consultation_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'consultations',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },
      payment_type: {
        type: Sequelize.ENUM('consultation', 'case_fee', 'deposit', 'refund'),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.ENUM('bank_transfer', 'credit_card', 'e_wallet', 'cash'),
        allowNull: false,
        defaultValue: 'bank_transfer'
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
        allowNull: false,
        defaultValue: 'pending'
      },
      transaction_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      payment_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('payments', ['user_id'], { name: 'idx_payments_user_id' });
    await queryInterface.addIndex('payments', ['case_id'], { name: 'idx_payments_case_id' });
    await queryInterface.addIndex('payments', ['consultation_id'], { name: 'idx_payments_consultation_id' });
    await queryInterface.addIndex('payments', ['status'], { name: 'idx_payments_status' });
    await queryInterface.addIndex('payments', ['transaction_id'], { name: 'idx_payments_transaction_id' });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payments');
  }
};
