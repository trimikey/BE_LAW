const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { User, Role, PasswordReset, RefreshToken, Lawyer } = require('../models');
const { sendPasswordResetEmail } = require('../utils/email');
const { sendVerifyEmail } = require('../utils/email');

/**
 * Đăng ký tài khoản mới
 */
const signup = async (req, res) => {
    console.log('--- Signup Attempt ---');
    console.log('Body:', req.body);
    console.log('File:', req.file);
    try {
        // Kiểm tra validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation Errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: `Dữ liệu không hợp lệ: ${errors.array().map(e => e.msg).join(', ')}`,
                errors: errors.array()
            });
        }

        const { email, password, fullName, phone, roleId, } = req.body;
        const lawyerInfo = req.body.lawyerInfo
            ? JSON.parse(req.body.lawyerInfo)
            : null;
        // Kiểm tra email đã tồn tại chưa
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email này đã được sử dụng.'
            });
        }

        // Mặc định role là client (role_id = 3) nếu không chỉ định
        const finalRoleId = roleId || 3;
        if (finalRoleId === 2 && !req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng upload chứng chỉ hành nghề luật sư.'
            });
        }
        // Nếu đăng ký lawyer, kiểm tra thông tin bắt buộc
        if (finalRoleId === 2 && lawyerInfo) {
            if (!lawyerInfo.barNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Số thẻ luật sư là bắt buộc.'
                });
            }

            // Kiểm tra số thẻ luật sư đã tồn tại chưa
            const existingLawyer = await Lawyer.findOne({
                where: { bar_number: lawyerInfo.barNumber }
            });

            if (existingLawyer) {
                return res.status(400).json({
                    success: false,
                    message: 'Số thẻ luật sư này đã được sử dụng.'
                });
            }
        }

        // Tạo user mới (password sẽ tự động hash bởi hook)
        const newUser = await User.create({
            email,
            password, // Sẽ được hash tự động bởi beforeCreate hook
            full_name: fullName,
            phone: phone || null,
            role_id: finalRoleId,
            is_active: finalRoleId === 2 ? false : true, // Lawyer cần verify trước khi active
            email_verified: false
        });
        // ===== TẠO TOKEN VERIFY EMAIL =====
        const verifyToken = crypto.randomBytes(32).toString('hex');

        const cleanFrontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
        const verifyUrl = `${cleanFrontendUrl}/verify-email?token=${verifyToken}`;


        await newUser.update({
            email_verify_token: verifyToken,
            email_verify_expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 giờ
        });

        // ===== GỬI EMAIL VERIFY =====
        try {
            await sendVerifyEmail(
                newUser.email,
                newUser.full_name,
                verifyUrl
            );
        } catch (emailError) {
            console.error('Verify email sending error:', emailError);
        }


        // Nếu đăng ký lawyer, tạo thông tin lawyer
        if (finalRoleId === 2 && lawyerInfo) {
            await Lawyer.create({
                user_id: newUser.id,
                bar_number: lawyerInfo.barNumber,
                certificate_number: lawyerInfo.certificateNumber || null,
                license_issued_date: lawyerInfo.licenseIssuedDate || null,
                license_expiry_date: lawyerInfo.licenseExpiryDate || null,
                law_firm: lawyerInfo.lawFirm || null,
                specialties: lawyerInfo.specialties ? JSON.stringify(lawyerInfo.specialties) : null,
                years_of_experience: lawyerInfo.yearsOfExperience || null,
                consultation_fee: lawyerInfo.consultationFee || null,
                bio: lawyerInfo.bio || null,
                license_file: req.file.path, // ✅ FILE

                verification_status: 'pending'
            });
        }

        // Lấy thông tin user với role
        const userWithRole = await User.findByPk(newUser.id, {
            include: [{
                model: Role,
                as: 'role',
                attributes: ['id', 'name', 'description']
            }],
            attributes: { exclude: ['password'] }
        });

        const message = finalRoleId === 2
            ? 'Đăng ký thành công! Tài khoản của bạn đang chờ xác thực từ admin.'
            : 'Đăng ký thành công!';

        res.status(201).json({
            success: true,
            message,
            data: {
                user: {
                    id: userWithRole.id,
                    email: userWithRole.email,
                    full_name: userWithRole.full_name,
                    phone: userWithRole.phone,
                    role_id: userWithRole.role_id,
                    role_name: userWithRole.role.name
                }
            }
        });
    } catch (error) {
        console.error('Signup Error Detailed:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({
            success: false,
            message: 'Lỗi đăng ký: ' + error.message,
            error: error.message
        });
    }
};

/**
 * Đăng nhập
 */
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Tìm user theo email với role
        const user = await User.findOne({
            where: { email },
            include: [{
                model: Role,
                as: 'role',
                attributes: ['id', 'name', 'description']
            }]
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng.'
            });
        }
        if (!user.email_verified) {
            return res.status(403).json({
                success: false,
                message: 'Vui lòng xác thực email trước khi đăng nhập.'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản đang chờ admin duyệt.'
            });
        }


        // Kiểm tra password (dùng instance method)
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Email hoặc mật khẩu không đúng.'
            });
        }

        // Cập nhật last_login
        await user.update({ last_login: new Date() });

        // Tạo JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, roleId: user.role_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Tạo refresh token (lưu vào database)
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 ngày

        await RefreshToken.create({
            user_id: user.id,
            token: refreshToken,
            expires_at: refreshTokenExpiry
        });

        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    roleId: user.role_id,
                    roleName: user.role.name
                },
                token,
                refreshToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đăng nhập. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Đăng xuất
 */
const logout = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;

        // Xóa refresh token khỏi database
        if (refreshToken) {
            await RefreshToken.destroy({
                where: { token: refreshToken }
            });
        }

        res.json({
            success: true,
            message: 'Đăng xuất thành công!'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đăng xuất. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Refresh token
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token không được để trống.'
            });
        }

        // Kiểm tra refresh token trong database
        const tokenData = await RefreshToken.findOne({
            where: { token: refreshToken }
        });

        if (!tokenData) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token không hợp lệ.'
            });
        }

        // Kiểm tra token đã hết hạn chưa
        if (new Date() > new Date(tokenData.expires_at)) {
            await RefreshToken.destroy({
                where: { token: refreshToken }
            });
            return res.status(401).json({
                success: false,
                message: 'Refresh token đã hết hạn.'
            });
        }

        // Lấy thông tin user
        const user = await User.findByPk(tokenData.user_id);

        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Người dùng không hợp lệ.'
            });
        }

        // Tạo JWT token mới
        const newToken = jwt.sign(
            { userId: user.id, email: user.email, roleId: user.role_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        res.json({
            success: true,
            data: {
                token: newToken
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi refresh token.'
        });
    }
};

/**
 * Quên mật khẩu - Gửi email reset
 */
const forgotPassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Email không hợp lệ.',
                errors: errors.array()
            });
        }

        const { email } = req.body;

        // Tìm user theo email
        const user = await User.findOne({
            where: { email },
            attributes: ['id', 'email', 'full_name']
        });

        // Luôn trả về success để tránh email enumeration attack
        if (!user) {
            return res.json({
                success: true,
                message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.'
            });
        }

        // Tạo reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Hết hạn sau 1 giờ

        // Lưu token vào database (tìm và cập nhật hoặc tạo mới)
        const existingReset = await PasswordReset.findOne({
            where: { user_id: user.id }
        });

        if (existingReset) {
            await existingReset.update({
                token: resetToken,
                expires_at: expiresAt,
                used: false
            });
        } else {
            await PasswordReset.create({
                user_id: user.id,
                token: resetToken,
                expires_at: expiresAt,
                used: false
            });
        }

        // Gửi email reset password
        try {
            await sendPasswordResetEmail(user.email, user.full_name, resetToken);
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Vẫn trả về success để không lộ thông tin
        }

        res.json({
            success: true,
            message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi xử lý yêu cầu. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Đặt lại mật khẩu với token
 */
const resetPassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không hợp lệ',
                errors: errors.array()
            });
        }

        const { token, newPassword } = req.body;

        // Tìm reset token trong database
        const resetTokenData = await PasswordReset.findOne({
            where: { token }
        });

        if (!resetTokenData) {
            return res.status(400).json({
                success: false,
                message: 'Token đặt lại mật khẩu không hợp lệ.'
            });
        }

        // Kiểm tra token đã được sử dụng chưa
        if (resetTokenData.used) {
            return res.status(400).json({
                success: false,
                message: 'Token này đã được sử dụng. Vui lòng yêu cầu token mới.'
            });
        }

        // Kiểm tra token đã hết hạn chưa
        if (new Date() > new Date(resetTokenData.expires_at)) {
            return res.status(400).json({
                success: false,
                message: 'Token đã hết hạn. Vui lòng yêu cầu token mới.'
            });
        }

        // Lấy user và cập nhật password (sẽ tự động hash bởi hook)
        const user = await User.findByPk(resetTokenData.user_id);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Người dùng không tồn tại.'
            });
        }

        await user.update({ password: newPassword }); // Hook sẽ hash password

        // Đánh dấu token đã được sử dụng
        await resetTokenData.update({ used: true });

        res.json({
            success: true,
            message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đặt lại mật khẩu. Vui lòng thử lại sau.'
        });
    }
};

/**
 * Lấy thông tin user hiện tại
 */
const getMe = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            include: [{
                model: Role,
                as: 'role',
                attributes: ['id', 'name', 'description']
            }],
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    phone: user.phone,
                    role_id: user.role_id,
                    role_name: user.role.name,
                    is_active: user.is_active,
                    email_verified: user.email_verified,
                    last_login: user.last_login,
                    created_at: user.created_at
                }
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi lấy thông tin người dùng.'
        });
    }
};
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu token xác thực.'
            });
        }

        // 🔹 Tìm user theo token
        const user = await User.findOne({
            where: { email_verify_token: token }
        });

        // 🔹 Nếu không tìm thấy user theo token
        if (!user) {
            // 👉 Có thể user đã verify trước đó
            const verifiedUser = await User.findOne({
                where: { email_verified: true }
            });

            if (verifiedUser) {
                return res.json({
                    success: true,
                    message: 'Email đã được xác thực trước đó.'
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Token xác thực không hợp lệ hoặc đã hết hạn.'
            });
        }

        // 🔹 Token hết hạn
        if (new Date() > user.email_verify_expires) {
            return res.status(400).json({
                success: false,
                message: 'Token xác thực đã hết hạn.'
            });
        }

        // 🔹 Verify
        await user.update({
            email_verified: true,
            email_verify_token: null,
            email_verify_expires: null
        });

        return res.json({
            success: true,
            message: 'Xác thực email thành công! Bạn có thể đăng nhập.'
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi xác thực email.'
        });
    }
};

const updateMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fullName, phone, bio, specialties, yearsOfExperience } = req.body;

        const user = await User.findByPk(userId, {
            include: [{ model: Role, as: 'role' }]
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        }

        // Update user base info
        const userUpdate = {};
        if (fullName) userUpdate.full_name = fullName;
        if (phone) userUpdate.phone = phone;

        await user.update(userUpdate);

        // If user is a lawyer, update lawyer specific info
        if (user.role.name === 'lawyer') {
            const lawyer = await Lawyer.findOne({ where: { user_id: userId } });
            if (lawyer) {
                const lawyerUpdate = {};
                if (bio !== undefined) lawyerUpdate.bio = bio;
                if (specialties !== undefined) lawyerUpdate.specialties = typeof specialties === 'string' ? specialties : JSON.stringify(specialties);
                if (yearsOfExperience !== undefined) lawyerUpdate.years_of_experience = yearsOfExperience;

                await lawyer.update(lawyerUpdate);
            }
        }

        const updatedUser = await User.findByPk(userId, {
            include: [{
                model: Role,
                as: 'role',
                attributes: ['id', 'name', 'description']
            }],
            attributes: { exclude: ['password'] }
        });

        res.json({
            success: true,
            message: 'Cập nhật hồ sơ thành công',
            data: {
                user: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    full_name: updatedUser.full_name,
                    phone: updatedUser.phone,
                    role_id: updatedUser.role_id,
                    role_name: updatedUser.role.name,
                    is_active: updatedUser.is_active,
                    email_verified: updatedUser.email_verified,
                    last_login: updatedUser.last_login,
                    created_at: updatedUser.created_at
                }
            }
        });
    } catch (error) {
        console.error('Update me error:', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật hồ sơ' });
    }
};

const uploadLicense = async (req, res) => {
    try {
        const lawyer = await Lawyer.findOne({
            where: { user_id: req.user.id }
        });

        if (!lawyer) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hồ sơ luật sư'
            });
        }

        lawyer.license_file = req.file.path;
        lawyer.verification_status = 'pending';
        await lawyer.save();

        res.json({
            success: true,
            message: 'Upload chứng chỉ thành công, chờ admin xét duyệt'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lỗi upload chứng chỉ'
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới.'
            });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        // Kiểm tra mật khẩu cũ
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu cũ không chính xác.'
            });
        }

        // Cập nhật mật khẩu mới (hook beforeUpdate sẽ tự hash)
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Đổi mật khẩu thành công.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi đổi mật khẩu.'
        });
    }
};

module.exports = {
    signup,
    login,
    logout,
    refreshToken,
    forgotPassword,
    resetPassword,
    getMe,
    verifyEmail,
    updateMe,
    uploadLicense,
    changePassword
};

const updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        if (!fcmToken) return res.status(400).json({ success: false, message: 'Thi?u FCM Token.' });
        await User.update({ fcm_token: fcmToken }, { where: { id: req.user.id } });
        res.json({ success: true, message: 'C?p nh?t FCM Token th�nh c�ng.' });
    } catch (error) {
        console.error('Update FCM token error:', error);
        res.status(500).json({ success: false, message: 'L?i c?p nh?t FCM Token.' });
    }
};

// Re-defining exports at the bottom since appending is easier
module.exports = { ...module.exports, updateFcmToken };
