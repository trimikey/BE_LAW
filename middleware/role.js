const { Role } = require('../models');

/**
 * Middleware kiểm tra quyền truy cập dựa trên role
 * @param {Array} allowedRoles - Mảng các role được phép truy cập, ví dụ: ['admin', 'lawyer']
 */
const authorize = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // req.user đã được set bởi middleware authenticate
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Vui lòng đăng nhập trước.'
                });
            }

            // Lấy tên role từ database
            const role = await Role.findByPk(req.user.roleId, {
                attributes: ['id', 'name']
            });

            if (!role) {
                return res.status(403).json({
                    success: false,
                    message: 'Không tìm thấy quyền của người dùng.'
                });
            }

            // Kiểm tra xem role của user có trong danh sách được phép không
            if (!allowedRoles.includes(role.name)) {
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền truy cập tài nguyên này.'
                });
            }

            // Gắn role name vào request
            req.user.role = role.name;
            next();
        } catch (error) {
            console.error('Role middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Lỗi kiểm tra quyền.'
            });
        }
    };
};

module.exports = authorize;
