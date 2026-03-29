'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE payments
      MODIFY COLUMN payment_method ENUM('bank_transfer', 'credit_card', 'e_wallet', 'cash', 'momo')
      NOT NULL DEFAULT 'bank_transfer';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE payments
      MODIFY COLUMN payment_method ENUM('bank_transfer', 'credit_card', 'e_wallet', 'cash')
      NOT NULL DEFAULT 'bank_transfer';
    `);
  }
};

