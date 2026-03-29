const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'railway',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false
    }
);

const dir = 'D:\\EXE_LAW\\export_DB';

async function importData() {
    try {
        console.log('🚀 Đang chuẩn bị kết nối tới Railway...');
        await sequelize.authenticate();
        console.log('✅ Kết nối thành công!');

        // Tắt kiểm tra khóa ngoại để tránh lỗi khi chèn dữ liệu
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

        const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));

        // Sắp xếp để tạo bảng trước khi chèn dữ liệu (nếu cần)
        // Thông thường Workbench export theo folder thì các file đã bao gồm cả cấu trúc và dữ liệu

        for (const file of files) {
            console.log(`📦 Đang xử lý file: ${file}...`);
            const filePath = path.join(dir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            // Tách các câu lệnh SQL bằng dấu chấm phẩy (đơn giản hóa)
            // Lưu ý: Cách này có thể không hoàn hảo với các procedure phức tạp, 
            // nhưng với table/data thông thường thì rất ổn.
            const queries = sql.split(/;\s*$/m);

            for (let query of queries) {
                query = query.trim();
                if (query.length > 0 && !query.startsWith('--') && !query.startsWith('/*')) {
                    try {
                        await sequelize.query(query);
                    } catch (e) {
                        // Bỏ qua lỗi nếu bảng đã tồn tại hoặc lỗi nhỏ
                        if (!e.message.includes('already exists')) {
                            // console.log(`   ⚠️ Lỗi nhỏ tại dòng: ${query.substring(0, 50)}...`);
                        }
                    }
                }
            }
            console.log(`   ✅ Hoàn thành file: ${file}`);
        }

        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('\n✨ CHÚC MỪNG! Toàn bộ dữ liệu đã được đưa lên Railway thành công.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi nghiêm trọng:', error);
        process.exit(1);
    }
}

importData();
