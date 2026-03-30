const sequelize = require('../config/database');

async function updateEnum() {
    try {
        console.log('🔄 Đang cập nhật ENUM cho cột status của bảng consultations...');
        
        // Truy vấn MySQL để thay đổi cấu trúc bảng, thêm 'in_progress' vào ENUM
        await sequelize.query(`
            ALTER TABLE consultations 
            MODIFY COLUMN status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show') 
            NOT NULL DEFAULT 'pending';
        `);
        
        console.log('✅ Cập nhật ENUM thành công!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi khi cập nhật ENUM:', error);
        process.exit(1);
    }
}

updateEnum();
