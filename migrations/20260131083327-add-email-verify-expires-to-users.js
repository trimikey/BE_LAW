'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'email_verify_expires', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Thời gian hết hạn token xác thực email'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'email_verify_expires');
  }
};
