'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'avatar', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Ảnh đại diện người dùng'
    });   
  },    

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'avatar');
  }
};
