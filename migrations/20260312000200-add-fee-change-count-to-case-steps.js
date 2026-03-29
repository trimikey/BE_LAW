'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('case_steps', 'fee_change_count', {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Số lần thay đổi phí giai đoạn'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('case_steps', 'fee_change_count');
    }
};
