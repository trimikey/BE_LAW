-- Tạo database
CREATE DATABASE IF NOT EXISTS lawyer_platform_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lawyer_platform_db;

-- Bảng roles (vai trò)
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE COMMENT 'Tên vai trò: admin, lawyer, client',
    description TEXT COMMENT 'Mô tả vai trò',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng users (người dùng)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã hash',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Tài khoản có bị khóa không',
    email_verified BOOLEAN DEFAULT FALSE COMMENT 'Email đã xác thực chưa',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    INDEX idx_email (email),
    INDEX idx_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng password_resets (đặt lại mật khẩu)
CREATE TABLE IF NOT EXISTS password_resets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL COMMENT 'Token hết hạn sau 1 giờ',
    used BOOLEAN DEFAULT FALSE COMMENT 'Token đã được sử dụng chưa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng refresh_tokens (để refresh JWT)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert các roles mặc định
INSERT INTO roles (name, description) VALUES
('admin', 'Quản trị viên hệ thống'),
('lawyer', 'Luật sư'),
('client', 'Khách hàng')
ON DUPLICATE KEY UPDATE name=name;

-- Tạo user admin mặc định (password: Admin123!)
-- Password hash: $2a$10$rK8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X
-- Bạn nên thay đổi password này sau khi deploy
INSERT INTO users (email, password, full_name, role_id, is_active, email_verified) VALUES
('admin@lawyerplatform.com', '$2a$10$rK8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X8X', 'Admin User', 1, TRUE, TRUE)
ON DUPLICATE KEY UPDATE email=email;
