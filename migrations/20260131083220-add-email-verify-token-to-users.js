'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'email_verify_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Token xác thực email'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'email_verify_token');
  }
};
