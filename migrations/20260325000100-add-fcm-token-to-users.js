'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'fcm_token', {
            type: Sequelize.STRING,
            allowNull: true,
            after: 'avatar'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'fcm_token');
    }
};
