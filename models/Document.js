const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Document = sequelize.define('Document', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    case_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'cases',
            key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID vụ việc (nếu có)'
    },
    consultation_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'consultations',
            key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID lịch tư vấn (nếu có)'
    },
    case_step_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'case_steps',
            key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'ID giai đoạn vụ việc'
    },
    uploaded_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'Người upload'
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Tên file gốc'
    },
    file_path: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Đường dẫn file trên server'
    },
    file_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL file (nếu dùng cloud storage)'
    },
    file_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Loại file (MIME type)'
    },
    file_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Kích thước file (bytes)'
    },
    category: {
        type: DataTypes.ENUM('original', 'copy', 'power_of_attorney', 'evidence', 'contract', 'other'),
        allowNull: false,
        defaultValue: 'other',
        comment: 'Danh mục file'
    },
    document_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Loại tài liệu (CMND, CCCD, Giấy phép, etc.)'
    },
    is_original: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Có phải bản gốc không'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả file'
    },
    version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'Phiên bản file'
    },
    parent_document_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'documents',
            key: 'id'
        },
        comment: 'ID file gốc (nếu là version mới)'
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Đã được xác thực chưa'
    },
    verified_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        comment: 'Người xác thực'
    },
    verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian xác thực'
    }
}, {
    tableName: 'documents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['case_id'] },
        { fields: ['consultation_id'] },
        { fields: ['uploaded_by'] },
        { fields: ['category'] },
        { fields: ['is_original'] },
        { fields: ['is_verified'] }
    ]
});

module.exports = Document;
