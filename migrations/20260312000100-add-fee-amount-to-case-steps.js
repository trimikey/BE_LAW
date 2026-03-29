'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('case_steps', 'fee_amount', {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: true,
            defaultValue: 0,
            comment: 'Số tiền thanh toán cho bước này'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('case_steps', 'fee_amount');
    }
};
