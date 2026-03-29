require('dotenv').config();
const { sequelize } = require('./models');

async function migrate() {
    try {
        console.log('Adding client_response to case_steps...');
        await sequelize.query('ALTER TABLE case_steps ADD COLUMN client_response TEXT NULL AFTER notes');
    } catch (e) {
        console.log('client_response might already exist or error:', e.message);
    }

    try {
        console.log('Adding case_step_id to documents...');
        await sequelize.query('ALTER TABLE documents ADD COLUMN case_step_id INT NULL AFTER consultation_id');
        await sequelize.query('ALTER TABLE documents ADD CONSTRAINT fk_document_case_step FOREIGN KEY (case_step_id) REFERENCES case_steps(id) ON DELETE SET NULL');
    } catch (e) {
        console.log('case_step_id might already exist or error:', e.message);
    }

    try {
        console.log('Adding client_data to case_steps...');
        await sequelize.query('ALTER TABLE case_steps ADD COLUMN client_data JSON NULL AFTER client_response');
    } catch (e) {
        console.log('client_data might already exist or error:', e.message);
    }

    console.log('Migration completed.');
    process.exit(0);
}

migrate();
