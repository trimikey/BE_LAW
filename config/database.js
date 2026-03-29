const { Sequelize } = require('sequelize');
require('dotenv').config();

// Log connection info (safe parts)
// console.log('--- Database Connection Debug ---');
// console.log('Host:', process.env.DB_HOST);
// console.log('Port:', process.env.DB_PORT);
// console.log('User:', process.env.DB_USER);
// console.log('DB Name:', process.env.DB_NAME);
// console.log('---------------------------------');

const sequelize = process.env.DATABASE_URL
    ? new Sequelize(process.env.DATABASE_URL, {
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
        define: { timestamps: true, underscored: false, freezeTableName: true }
    })
    : new Sequelize(
        process.env.DB_NAME || 'lawyer_platform_db',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD,
        {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT) || 3306,
            dialect: 'mysql',
            logging: process.env.NODE_ENV === 'development' ? console.log : false,
            pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
            define: { timestamps: true, underscored: false, freezeTableName: true }
        }
    );

// Test connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Kết nối MySQL thành công với Sequelize!');
    } catch (error) {
        console.error('❌ Lỗi kết nối MySQL:', error.message);
        if (error.original) {
            console.error('Chi tiết lỗi:', error.original.sqlMessage || error.original.message);
        }
    }
};

testConnection();

module.exports = sequelize;
