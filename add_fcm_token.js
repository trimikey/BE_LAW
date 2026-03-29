require('dotenv').config();
const { Sequelize } = require('sequelize');

if (!process.env.DB_NAME) {
    console.error('Environment variables not loaded');
    process.exit(1);
}

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: console.log
});

const run = async () => {
    try {
        const queryInterface = sequelize.getQueryInterface();
        const columns = await queryInterface.describeTable('users');

        if (!columns.fcm_token) {
            console.log('Adding fcm_token column to users table...');
            await queryInterface.addColumn('users', 'fcm_token', {
                type: Sequelize.STRING,
                allowNull: true
            });
            console.log('✅ Column fcm_token added successfully!');
        } else {
            console.log('Column fcm_token already exists.');
        }
    } catch (error) {
        console.error('Error adding column:', error);
    } finally {
        await sequelize.close();
    }
};

run();
