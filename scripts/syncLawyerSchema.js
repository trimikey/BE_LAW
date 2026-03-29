require('dotenv').config();
const { Lawyer } = require('../models');
const sequelize = require('../config/database');

const syncLawyer = async () => {
    try {
        console.log('Syncing Lawyer model...');
        await Lawyer.sync({ alter: true });
        console.log('Lawyer table synced successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error syncing Lawyer table:', error);
        process.exit(1);
    }
};

syncLawyer();
