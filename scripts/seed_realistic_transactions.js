
const { sequelize, User, Payment, Role, Case } = require('../models');
const { Op } = require('sequelize');

const REAL_NAMES = [
    { name: 'Nguyễn Minh Long', email: 'nguyenMinhLongtd@gmail.com' },
    { name: 'Trần Thanh Hà', email: 'thanhha.tran88@gmail.com' },
    { name: 'Lê Văn Duy', email: 'duyle.van92@gmail.com' },
    { name: 'Phạm Thị Kim Chi', email: 'kimchi.pham_law@gmail.com' },
    { name: 'Hoàng Văn Thái', email: 'thaihoang85@gmail.com' },
    { name: 'Vũ Thị Ngọc', email: 'ngocvu.vlaw@gmail.com' },
    { name: 'Trương Bá Đạt', email: 'dat.truongba@gmail.com' },
    { name: 'Đặng Minh Châu', email: 'chaudang_minh@gmail.com' },
    { name: 'Phan Đình Tùng', email: 'tungphan.dinh@gmail.com' },
    { name: 'Lý Nhã Kỳ', email: 'lynhaky90@gmail.com' },
    { name: 'Bùi Xuân Huy', email: 'huybui.vn@gmail.com' },
    { name: 'Ngô Ngọc Lễ', email: 'lengongoc_tuvan@gmail.com' },
    { name: 'Hồ Anh Tuấn', email: 'tuanhho_dev@gmail.com' },
    { name: 'Đỗ Duy Mạnh', email: 'duymanh.do@gmail.com' },
    { name: 'Nguyễn Văn Quyết', email: 'quyetnguyen.lawyer@gmail.com' },
    { name: 'Trần Đình Trọng', email: 'trongtrandinh.95@gmail.com' },
    { name: 'Quế Ngọc Hải', email: 'haiquengoc@gmail.com' },
    { name: 'Nguyễn Tiến Linh', email: 'tienlinh.nguyen@gmail.com' },
    { name: 'Phạm Đức Huy', email: 'huyphamduc@gmail.com' },
    { name: 'Nguyễn Quang Hải', email: 'quanghai.nguyen19@gmail.com' },
    { name: 'Trần Nguyên Mạnh', email: 'manhtran_nguyen@gmail.com' },
    { name: 'Hồ Tấn Tài', email: 'tantai.ho@gmail.com' },
    { name: 'Nguyễn Thanh Bình', email: 'thanhbinh.ng@gmail.com' },
    { name: 'Nguyễn Hoàng Đức', email: 'hoangduc.nguyen@gmail.com' },
    { name: 'Phạm Tuấn Hải', email: 'tuanhai.pham@gmail.com' }
];

function generateTransactionID() {
    const prefix = Math.random() > 0.5 ? '177' : '182';
    const body = Math.floor(Math.random() * 900000000) + 100000000;
    return `${prefix}${body}`;
}

async function seed() {
    try {
        await sequelize.authenticate();

        // Cleanup
        await Payment.destroy({ where: { transaction_id: { [Op.like]: '177%' } } });
        await Payment.destroy({ where: { transaction_id: { [Op.like]: '182%' } } });
        // Delete users by email
        const emails = REAL_NAMES.map(n => n.email);
        await User.destroy({ where: { email: { [Op.in]: emails } } });

        const lawyerRole = await Role.findOne({ where: { name: 'lawyer' } });
        const clientRole = await Role.findOne({ where: { name: 'client' } });
        const lawyerUser = await User.findOne({ where: { role_id: lawyerRole.id } });
        let mockCase = await Case.findOne({ where: { lawyer_id: lawyerUser.id } });

        console.log('Generating 25 transactions with RECENT dates to show on Page 1...');

        for (let i = 0; i < REAL_NAMES.length; i++) {
            const status = i < 20 ? 'completed' : 'pending';
            const data = REAL_NAMES[i];
            
            const user = await User.create({
                full_name: data.name,
                email: data.email,
                password: 'password123',
                role_id: clientRole.id,
                email_verified: true
            });

            const amount = [500000, 1000000, 1500000, 2000000, 3000000][Math.floor(Math.random() * 5)];
            const transaction_id = generateTransactionID();

            // Set dates to April 1st and April 2nd to ensure they are the LATEST
            const date = new Date('2026-04-02T10:00:00');
            if (i > 10) date.setDate(1); // Half on April 1st
            date.setHours(9 + (i % 8), Math.floor(Math.random() * 60));

            await Payment.create({
                user_id: user.id,
                case_id: mockCase.id,
                amount: amount,
                payment_type: 'case_fee',
                payment_method: 'payos',
                status: status,
                transaction_id: transaction_id,
                payment_date: status === 'completed' ? date : null,
                notes: `Thanh toán phí dịch vụ #${i}`,
                created_at: date,
                updated_at: date
            });
        }

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seed();
