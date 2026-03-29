'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('lawyers', 'license_file', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'File giấy phép hành nghề luật sư (PDF / image / URL)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('lawyers', 'license_file');
  }
};
