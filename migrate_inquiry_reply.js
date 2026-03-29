const { sequelize } = require('./models');
const { QueryTypes } = require('sequelize');

async function migrate() {
    try {
        console.log('Starting migration: Add lawyer_reply to inquiries...');

        // Check if column exists
        const columns = await sequelize.query(
            "SHOW COLUMNS FROM inquiries LIKE 'lawyer_reply'",
            { type: QueryTypes.SELECT }
        );

        if (columns.length === 0) {
            await sequelize.query("ALTER TABLE inquiries ADD COLUMN lawyer_reply TEXT NULL");
            console.log('✅ Column lawyer_reply added successfully.');
        } else {
            console.log('ℹ️ Column lawyer_reply already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
