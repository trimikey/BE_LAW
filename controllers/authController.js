const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { User, Role, PasswordReset, RefreshToken, Lawyer } = require('../models');
const { sendPasswordResetEmail } = require('../utils/email');
const { sendVerifyEmail } = require('../utils/email');

/**
 * ÄÄƒng kÃ½ tÃ i khoáº£n má»›i
 */
const signup = async (req, res) => {
    console.log('--- Signup Attempt ---');
    console.log('Body:', req.body);
    console.log('File:', req.file);
    try {
        // Kiá»ƒm tra validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation Errors:', errors.array());
            return res.status(400).json({
                success: false,
                message: `Dá»¯ liá»‡u khÃ´ng há»£p lá»‡: ${errors.array().map(e => e.msg).join(', ')}`,
                errors: errors.array()
            });
        }

        const { email, password, fullName, phone, roleId, } = req.body;
        const lawyerInfo = req.body.lawyerInfo
            ? JSON.parse(req.body.lawyerInfo)
            : null;
        // Kiá»ƒm tra email Ä‘Ã£ tá»“n táº¡i chÆ°a
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.'
            });
        }

        // Máº·c Ä‘á»‹nh role lÃ  client (role_id = 3) náº¿u khÃ´ng chá»‰ Ä‘á»‹nh
        const finalRoleId = roleId || 3;
        if (finalRoleId === 2 && !req.file) {
            return res.status(400).json({
                success: false,
                message: 'Vui lÃ²ng upload chá»©ng chá»‰ hÃ nh nghá» luáº­t sÆ°.'
            });
        }
        // Náº¿u Ä‘Äƒng kÃ½ lawyer, kiá»ƒm tra thÃ´ng tin báº¯t buá»™c
        if (finalRoleId === 2 && lawyerInfo) {
            if (!lawyerInfo.barNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Sá»‘ tháº» luáº­t sÆ° lÃ  báº¯t buá»™c.'
                });
            }

            // Kiá»ƒm tra sá»‘ tháº» luáº­t sÆ° Ä‘Ã£ tá»“n táº¡i chÆ°a
            const existingLawyer = await Lawyer.findOne({
                where: { bar_number: lawyerInfo.barNumber }
            });

            if (existingLawyer) {
                return res.status(400).json({
                    success: false,
                    message: 'Sá»‘ tháº» luáº­t sÆ° nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.'
                });
            }
        }

        // Táº¡o user má»›i (password sáº½ tá»± Ä‘á»™ng hash bá»Ÿi hook)
        const newUser = await User.create({
            email,
            password, // Sáº½ Ä‘Æ°á»£c hash tá»± Ä‘á»™ng bá»Ÿi beforeCreate hook
            full_name: fullName,
            phone: phone || null,
            role_id: finalRoleId,
            is_active: finalRoleId === 2 ? false : true, // Lawyer cáº§n verify trÆ°á»›c khi active
            email_verified: false
        });
        // ===== Táº O TOKEN VERIFY EMAIL =====
        const verifyToken = crypto.randomBytes(32).toString('hex');

        const cleanFrontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
        const verifyUrl = `${cleanFrontendUrl}/verify-email?token=${verifyToken}`;


        await newUser.update({
            email_verify_token: verifyToken,
            email_verify_expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 giá»
        });

        // ===== Gá»¬I EMAIL VERIFY =====
        try {
            await sendVerifyEmail(newUser.email, newUser.full_name, verifyUrl);
        } catch (emailError) {
            console.error('Verify email sending error:', emailError);
        }


        // Náº¿u Ä‘Äƒng kÃ½ lawyer, táº¡o thÃ´ng tin lawyer
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
                license_file: req.file.path, // âœ… FILE

                verification_status: 'pending'
            });
        }

        // Láº¥y thÃ´ng tin user vá»›i role
        const userWithRole = await User.findByPk(newUser.id, {
            include: [{
                model: Role,
                as: 'role',
                attributes: ['id', 'name', 'description']
            }],
            attributes: { exclude: ['password'] }
        });

        const message = finalRoleId === 2
            ? 'ÄÄƒng kÃ½ thÃ nh cÃ´ng! TÃ i khoáº£n cá»§a báº¡n Ä‘ang chá» xÃ¡c thá»±c tá»« admin.'
            : 'ÄÄƒng kÃ½ thÃ nh cÃ´ng!';

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
            message: 'Lá»—i Ä‘Äƒng kÃ½: ' + error.message,
            error: error.message
        });
    }
};

/**
 * ÄÄƒng nháº­p
 */
const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Dá»¯ liá»‡u khÃ´ng há»£p lá»‡',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // TÃ¬m user theo email vá»›i role
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
                message: 'Email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.'
            });
        }
        if (!user.email_verified) {
            return res.status(403).json({
                success: false,
                message: 'Vui lÃ²ng xÃ¡c thá»±c email trÆ°á»›c khi Ä‘Äƒng nháº­p.'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'TÃ i khoáº£n Ä‘ang chá» admin duyá»‡t.'
            });
        }


        // Kiá»ƒm tra password (dÃ¹ng instance method)
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng.'
            });
        }

        // Cáº­p nháº­t last_login
        await user.update({ last_login: new Date() });

        // Táº¡o JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, roleId: user.role_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '7d' }
        );

        // Táº¡o refresh token (lÆ°u vÃ o database)
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 ngÃ y

        await RefreshToken.create({
            user_id: user.id,
            token: refreshToken,
            expires_at: refreshTokenExpiry
        });

        res.json({
            success: true,
            message: 'ÄÄƒng nháº­p thÃ nh cÃ´ng!',
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
            message: 'Lá»—i Ä‘Äƒng nháº­p. Vui lÃ²ng thá»­ láº¡i sau.'
        });
    }
};

/**
 * ÄÄƒng xuáº¥t
 */
const logout = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;

        // XÃ³a refresh token khá»i database
        if (refreshToken) {
            await RefreshToken.destroy({
                where: { token: refreshToken }
            });
        }

        res.json({
            success: true,
            message: 'ÄÄƒng xuáº¥t thÃ nh cÃ´ng!'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Lá»—i Ä‘Äƒng xuáº¥t. Vui lÃ²ng thá»­ láº¡i sau.'
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
                message: 'Refresh token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.'
            });
        }

        // Kiá»ƒm tra refresh token trong database
        const tokenData = await RefreshToken.findOne({
            where: { token: refreshToken }
        });

        if (!tokenData) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token khÃ´ng há»£p lá»‡.'
            });
        }

        // Kiá»ƒm tra token Ä‘Ã£ háº¿t háº¡n chÆ°a
        if (new Date() > new Date(tokenData.expires_at)) {
            await RefreshToken.destroy({
                where: { token: refreshToken }
            });
            return res.status(401).json({
                success: false,
                message: 'Refresh token Ä‘Ã£ háº¿t háº¡n.'
            });
        }

        // Láº¥y thÃ´ng tin user
        const user = await User.findByPk(tokenData.user_id);

        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'NgÆ°á»i dÃ¹ng khÃ´ng há»£p lá»‡.'
            });
        }

        // Táº¡o JWT token má»›i
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
            message: 'Lá»—i refresh token.'
        });
    }
};

/**
 * QuÃªn máº­t kháº©u - Gá»­i email reset
 */
const forgotPassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Email khÃ´ng há»£p lá»‡.',
                errors: errors.array()
            });
        }

        const { email } = req.body;

        // TÃ¬m user theo email
        const user = await User.findOne({
            where: { email },
            attributes: ['id', 'email', 'full_name']
        });

        // LuÃ´n tráº£ vá» success Ä‘á»ƒ trÃ¡nh email enumeration attack
        if (!user) {
            return res.json({
                success: true,
                message: 'Náº¿u email tá»“n táº¡i, chÃºng tÃ´i Ä‘Ã£ gá»­i link Ä‘áº·t láº¡i máº­t kháº©u.'
            });
        }

        // Táº¡o reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Háº¿t háº¡n sau 1 giá»

        // LÆ°u token vÃ o database (tÃ¬m vÃ  cáº­p nháº­t hoáº·c táº¡o má»›i)
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

        // Gá»­i email reset password
        try {
            (user.email, user.full_name, resetToken);
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            // Váº«n tráº£ vá» success Ä‘á»ƒ khÃ´ng lá»™ thÃ´ng tin
        }

        res.json({
            success: true,
            message: 'Náº¿u email tá»“n táº¡i, chÃºng tÃ´i Ä‘Ã£ gá»­i link Ä‘áº·t láº¡i máº­t kháº©u.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lá»—i xá»­ lÃ½ yÃªu cáº§u. Vui lÃ²ng thá»­ láº¡i sau.'
        });
    }
};

/**
 * Äáº·t láº¡i máº­t kháº©u vá»›i token
 */
const resetPassword = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Dá»¯ liá»‡u khÃ´ng há»£p lá»‡',
                errors: errors.array()
            });
        }

        const { token, newPassword } = req.body;

        // TÃ¬m reset token trong database
        const resetTokenData = await PasswordReset.findOne({
            where: { token }
        });

        if (!resetTokenData) {
            return res.status(400).json({
                success: false,
                message: 'Token Ä‘áº·t láº¡i máº­t kháº©u khÃ´ng há»£p lá»‡.'
            });
        }

        // Kiá»ƒm tra token Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng chÆ°a
        if (resetTokenData.used) {
            return res.status(400).json({
                success: false,
                message: 'Token nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng. Vui lÃ²ng yÃªu cáº§u token má»›i.'
            });
        }

        // Kiá»ƒm tra token Ä‘Ã£ háº¿t háº¡n chÆ°a
        if (new Date() > new Date(resetTokenData.expires_at)) {
            return res.status(400).json({
                success: false,
                message: 'Token Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng yÃªu cáº§u token má»›i.'
            });
        }

        // Láº¥y user vÃ  cáº­p nháº­t password (sáº½ tá»± Ä‘á»™ng hash bá»Ÿi hook)
        const user = await User.findByPk(resetTokenData.user_id);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'NgÆ°á»i dÃ¹ng khÃ´ng tá»“n táº¡i.'
            });
        }

        await user.update({ password: newPassword }); // Hook sáº½ hash password

        // ÄÃ¡nh dáº¥u token Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng
        await resetTokenData.update({ used: true });

        res.json({
            success: true,
            message: 'Äáº·t láº¡i máº­t kháº©u thÃ nh cÃ´ng! Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lá»—i Ä‘áº·t láº¡i máº­t kháº©u. Vui lÃ²ng thá»­ láº¡i sau.'
        });
    }
};

/**
 * Láº¥y thÃ´ng tin user hiá»‡n táº¡i
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
                message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng.'
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
            message: 'Lá»—i láº¥y thÃ´ng tin ngÆ°á»i dÃ¹ng.'
        });
    }
};
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Thiáº¿u token xÃ¡c thá»±c.'
            });
        }

        // ðŸ”¹ TÃ¬m user theo token
        const user = await User.findOne({
            where: { email_verify_token: token }
        });

        // ðŸ”¹ Náº¿u khÃ´ng tÃ¬m tháº¥y user theo token
        if (!user) {
            // ðŸ‘‰ CÃ³ thá»ƒ user Ä‘Ã£ verify trÆ°á»›c Ä‘Ã³
            const verifiedUser = await User.findOne({
                where: { email_verified: true }
            });

            if (verifiedUser) {
                return res.json({
                    success: true,
                    message: 'Email Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c thá»±c trÆ°á»›c Ä‘Ã³.'
                });
            }

            return res.status(400).json({
                success: false,
                message: 'Token xÃ¡c thá»±c khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.'
            });
        }

        // ðŸ”¹ Token háº¿t háº¡n
        if (new Date() > user.email_verify_expires) {
            return res.status(400).json({
                success: false,
                message: 'Token xÃ¡c thá»±c Ä‘Ã£ háº¿t háº¡n.'
            });
        }

        // ðŸ”¹ Verify
        await user.update({
            email_verified: true,
            email_verify_token: null,
            email_verify_expires: null
        });

        return res.json({
            success: true,
            message: 'XÃ¡c thá»±c email thÃ nh cÃ´ng! Báº¡n cÃ³ thá»ƒ Ä‘Äƒng nháº­p.'
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: 'Lá»—i xÃ¡c thá»±c email.'
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
            return res.status(404).json({ success: false, message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng' });
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
            message: 'Cáº­p nháº­t há»“ sÆ¡ thÃ nh cÃ´ng',
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
        res.status(500).json({ success: false, message: 'Lá»—i cáº­p nháº­t há»“ sÆ¡' });
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
                message: 'KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ luáº­t sÆ°'
            });
        }

        lawyer.license_file = req.file.path;
        lawyer.verification_status = 'pending';
        await lawyer.save();

        res.json({
            success: true,
            message: 'Upload chá»©ng chá»‰ thÃ nh cÃ´ng, chá» admin xÃ©t duyá»‡t'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Lá»—i upload chá»©ng chá»‰'
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lÃ²ng cung cáº¥p máº­t kháº©u cÅ© vÃ  máº­t kháº©u má»›i.'
            });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'KhÃ´ng tÃ¬m tháº¥y ngÆ°á»i dÃ¹ng.'
            });
        }

        // Kiá»ƒm tra máº­t kháº©u cÅ©
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Máº­t kháº©u cÅ© khÃ´ng chÃ­nh xÃ¡c.'
            });
        }

        // Cáº­p nháº­t máº­t kháº©u má»›i (hook beforeUpdate sáº½ tá»± hash)
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Äá»•i máº­t kháº©u thÃ nh cÃ´ng.'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Lá»—i Ä‘á»•i máº­t kháº©u.'
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
        res.json({ success: true, message: 'C?p nh?t FCM Token thï¿½nh cï¿½ng.' });
    } catch (error) {
        console.error('Update FCM token error:', error);
        res.status(500).json({ success: false, message: 'L?i c?p nh?t FCM Token.' });
    }
};

// Re-defining exports at the bottom since appending is easier
module.exports = { ...module.exports, updateFcmToken };

