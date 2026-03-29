'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('roles', [
      {
        name: 'admin',
        description: 'Quản trị viên hệ thống',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'lawyer',
        description: 'Luật sư',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        name: 'client',
        description: 'Khách hàng',
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {
      ignoreDuplicates: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
