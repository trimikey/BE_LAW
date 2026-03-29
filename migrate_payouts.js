const { Payout } = require('./models');

const migrate = async () => {
    try {
        console.log('🔄 Creating payouts table...');
        await Payout.sync({ alter: true });
        console.log('✅ Payouts table created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating payouts table:', error);
        process.exit(1);
    }
};

migrate();
