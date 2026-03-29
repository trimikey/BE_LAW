const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware xác thực JWT token
 */
const authenticate = async (req, res, next) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Không có token xác thực. Vui lòng đăng nhập.'
            });
        }

        const token = authHeader.substring(7); // Bỏ "Bearer " prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Lấy thông tin user từ database
        const user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'email', 'full_name', 'role_id', 'is_active']
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng không tồn tại.'
            });
        }

        // Kiểm tra tài khoản có bị khóa không
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị khóa.'
            });
        }

        // Gắn thông tin user vào request để dùng ở các route tiếp theo
        req.user = {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            roleId: user.role_id
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token không hợp lệ.'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token đã hết hạn. Vui lòng đăng nhập lại.'
            });
        }
        
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi xác thực.'
        });
    }
};

module.exports = authenticate;
