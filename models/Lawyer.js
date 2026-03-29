const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lawyer = sequelize.define('Lawyer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    bar_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Số thẻ luật sư'
    },
    certificate_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Số chứng chỉ hành nghề'
    },
    license_issued_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày cấp chứng chỉ'
    },
    license_expiry_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày hết hạn chứng chỉ'
    },
    law_firm: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Tên văn phòng luật sư'
    },
    specialties: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Chuyên môn (JSON array)'
    },
    years_of_experience: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Số năm kinh nghiệm'
    },
    bio: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Tiểu sử'
    },
    verification_status: {
        type: DataTypes.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending',
        comment: 'Trạng thái xác thực: pending, verified, rejected'
    },
    verification_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Ghi chú xác thực từ admin'
    },
    verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Ngày xác thực'
    },
    verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Admin ID xác thực'
    },
    license_file: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'File chứng chỉ hành nghề luật sư'
    },
    education: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nơi đào tạo'
    },
    consultation_fee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Phí tư vấn'
    },
    rating: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
        comment: 'Điểm đánh giá trung bình'
    },
    review_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Số lượng đánh giá'
    },
    city: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Tỉnh/Thành phố'
    },
    bank_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Tên ngân hàng'
    },
    bank_account_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Số tài khoản ngân hàng'
    },
    bank_account_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Tên chủ tài khoản'
    }
}, {
    tableName: 'lawyers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['bar_number']
        },
        {
            fields: ['verification_status']
        }
    ]
});

module.exports = Lawyer;
