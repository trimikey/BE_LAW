require('dotenv').config({ path: './.env' });
const { Inquiry } = require('./models');

async function syncInquiry() {
    try {
        console.log('Syncing Inquiry model...');
        await Inquiry.sync({ alter: true });
        console.log('✅ Table "inquiries" has been created/updated successfully.');
    } catch (error) {
        console.error('❌ Error syncing Inquiry:', error);
    }
    process.exit();
}

syncInquiry();
