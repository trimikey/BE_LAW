require('dotenv').config({ path: './.env' });
const { Case, CaseStep } = require('./models');

async function syncPaymentFields() {
    try {
        console.log('Syncing Case and CaseStep for payment fields...');
        await Case.sync({ alter: true });
        await CaseStep.sync({ alter: true });
        console.log('✅ Payment fields have been added successfully.');
    } catch (error) {
        console.error('❌ Error syncing fields:', error);
    }
    process.exit();
}

syncPaymentFields();
