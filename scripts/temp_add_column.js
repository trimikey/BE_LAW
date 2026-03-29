require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'mysql'
});

async function run() {
    try {
        await sequelize.query('ALTER TABLE cases ADD COLUMN archived_at DATETIME NULL AFTER payment_mode');
        console.log('✅ Column archived_at added to cases table');
    } catch (err) {
        if (err.original && (err.original.errno === 1060 || err.original.code === 'ER_DUP_FIELDNAME')) {
            console.log('⚠️ Column already exists');
        } else {
            console.error('❌ Error adding column:', err);
        }
    } finally {
        await sequelize.close();
    }
}

run();
