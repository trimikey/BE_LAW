
const { sequelize, User, Payment, Role, Case, Lawyer } = require('../models');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('--- Connecting to DB... ---');

        // 1. Get roles
        const lawyerRole = await Role.findOne({ where: { name: 'lawyer' } });
        const clientRole = await Role.findOne({ where: { name: 'client' } });
        
        if (!lawyerRole || !clientRole) {
            console.error('Roles not found. Please sync database first.');
            process.exit(1);
        }

        // 2. Get a Lawyer user
        const lawyerUser = await User.findOne({ 
            where: { role_id: lawyerRole.id },
            include: [{ model: Lawyer, as: 'lawyer' }] 
        });
        
        if (!lawyerUser) {
            console.error('No lawyer found. Please register a lawyer account first to attribute revenue.');
            process.exit(1);
        }

        console.log(`Lawyer identified: ${lawyerUser.full_name} (${lawyerUser.email})`);

        // 3. Create a generic mock case if needed
        let mockCase = await Case.findOne({ where: { lawyer_id: lawyerUser.id } });
        if (!mockCase) {
           // We need a temporary client_id. Use id 1 or create a dummy.
           const dummyClient = await User.findOne({ where: { role_id: clientRole.id } });
           mockCase = await Case.create({
            title: 'Hồ sơ xử lý nhanh mẫu',
            description: 'Mô tả vụ việc mẫu dùng cho dữ liệu giao dịch',
            client_id: dummyClient ? dummyClient.id : lawyerUser.id, // Fallback
            lawyer_id: lawyerUser.id,
            status: 'in_progress',
            case_type: 'civil'
           });
           console.log('Created a mock case for attribution');
        }

        const SUCCESS_COUNT = 20;
        const FAIL_COUNT = 5;
        const total = SUCCESS_COUNT + FAIL_COUNT;
        
        console.log(`\n--- Generating ${total} new clients & transactions... ---`);

        for (let i = 1; i <= total; i++) {
            const status = i <= SUCCESS_COUNT ? 'completed' : 'failed';
            const randomSuffix = Math.floor(Math.random() * 99999);
            const email = `test.client.${i}.${randomSuffix}@gmail.com`;
            
            // Create a mock user
            const user = await User.create({
                full_name: `Hệ thống Giả lập ${i}`,
                email: email,
                password: '$2b$10$hashedpasswordforeaseofseeding', // Dummy hash
                role_id: clientRole.id,
                is_active: true,
                email_verified: true
            });

            // Random amount between 1tr and 10tr for SUCCESS, 500k-2tr for FAIL
            const amount = i <= SUCCESS_COUNT 
                ? (Math.floor(Math.random() * 10) + 2) * 500000 // 1M - 6M
                : (Math.floor(Math.random() * 5) + 1) * 200000; // 200k - 1.2M

            const date = new Date();
            // Spread across 30 days
            date.setDate(date.getDate() - Math.floor(Math.random() * 30)); 
            // Also spread hours/min
            date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));

            const transaction_id = `PAY_${status.toUpperCase()}_v${randomSuffix}_${i}`;

            await Payment.create({
                user_id: user.id,
                case_id: mockCase.id,
                amount: amount,
                payment_type: 'case_fee',
                payment_method: i % 2 === 0 ? 'bank_transfer' : 'payos',
                status: status,
                transaction_id: transaction_id,
                payment_date: status === 'completed' ? date : null,
                notes: `Seed data: ${status === 'completed' ? 'Thanh toán thành công' : 'Giao dịch bị từ chối'} #${i}`,
                created_at: date,
                updated_at: date
            });

            if (i % 5 === 0) console.log(`In progress: ${i}/${total}...`);
        }

        console.log(`\n✅ SUCCESSFULLY GENERATED:`);
        console.log(`- 20 Completed Transactions`);
        console.log(`- 5 Failed Transactions`);
        console.log(`- 25 Unique Client Accounts`);
        console.log(`Database synced and ready.`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ FATAL ERROR DURING SEEDING:', error);
        process.exit(1);
    }
}

seed();
