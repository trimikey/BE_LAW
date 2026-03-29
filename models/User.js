const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Mật khẩu đã hash'
    },
    full_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'roles',
            key: 'id'
        }
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Tài khoản có bị khóa không'
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Email đã xác thực chưa'
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true
    },
    avatar: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email_verify_token: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email_verify_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    created_by_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    fcm_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Firebase Cloud Messaging Token'
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['email']
        },
        {
            fields: ['role_id']
        }
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Instance method để so sánh password
User.prototype.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method để lấy user không có password
User.prototype.toJSON = function () {
    const values = { ...this.get() };
    delete values.password;
    return values;
};

module.exports = User;
