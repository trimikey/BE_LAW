const express = require('express');
const { body } = require('express-validator');
const {
    signup,
    login,
    logout,
    refreshToken,
    forgotPassword,
    resetPassword,
    getMe,
    verifyEmail,
    uploadLicense,
    changePassword,
    updateMe,
    updateFcmToken
} = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const upload = require('../middleware/uploadLicense');

const router = express.Router();

// Validation rules
const signupValidation = [
    body('email')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
    body('fullName')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Họ tên phải có từ 2 đến 255 ký tự'),
    body('phone')
        .optional({ checkFalsy: true })
        .matches(/^[0-9]{8,11}$/)
        .withMessage('Số điện thoại không hợp lệ'),
    body('roleId')
        .optional()
        .toInt()
        .isInt({ min: 1, max: 3 })
        .withMessage('Role ID phải là số từ 1 đến 3')
];

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Mật khẩu không được để trống')
];

const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Email không hợp lệ')
        .normalizeEmail()
];

const resetPasswordValidation = [
    body('token')
        .notEmpty()
        .withMessage('Token không được để trống'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Mật khẩu phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 số')
];

// Routes
router.post('/signup', upload.single('licenseFile'), signupValidation, signup);
router.post('/login', loginValidation, login);
router.post('/logout', logout);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.get('/verify-email', verifyEmail);

router.post(
    '/upload-license',
    upload.single('licenseFile'),
    uploadLicense
);
// Protected routes (cần đăng nhập)
router.get('/me', authenticate, getMe);
router.put('/update-me', authenticate, updateMe);
router.put('/change-password', authenticate, changePassword);
router.post('/update-fcm-token', authenticate, updateFcmToken);

module.exports = router;
