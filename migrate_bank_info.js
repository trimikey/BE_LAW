const { Lawyer } = require('./models');

const migrate = async () => {
    try {
        console.log('🔄 Updating lawyers table with bank info...');
        await Lawyer.sync({ alter: true });
        console.log('✅ Lawyers table updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating lawyers table:', error);
        process.exit(1);
    }
};

migrate();
