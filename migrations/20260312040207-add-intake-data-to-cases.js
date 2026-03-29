'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cases', 'intake_data', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Dữ liệu câu trả lời Intake của khách hàng'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('cases', 'intake_data');
  }
};
