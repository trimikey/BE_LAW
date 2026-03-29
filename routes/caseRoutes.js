const express = require('express');
const authenticate = require('../middleware/auth');
const {
    getCaseById,
    updateStepStatus,
    assignStep,
    updateStepPaymentStatus,
    getStepPaymentLink,
    verifyStepPayment
} = require('../controllers/caseController');

const router = express.Router();

// Public verification route (must be before authentication)
router.get('/payment/verify/:orderCode', verifyStepPayment);

// Tất cả các routes còn lại đều cần authentication
router.use(authenticate);

// Lấy chi tiết case với steps và documents
router.get('/:caseId', getCaseById);

// Cập nhật step status
router.patch('/:caseId/steps/:stepId', updateStepStatus);

// Cập nhật step payment status (Manual update)
router.patch('/:caseId/steps/:stepId/payment-status', updateStepPaymentStatus);

// Tạo link thanh toán PayOS cho step
router.post('/:caseId/steps/:stepId/payment-link', getStepPaymentLink);

// Gán step cho user
router.post('/:caseId/steps/:stepId/assign', assignStep);

// Cập nhật phản hồi từ client cho step
router.patch('/:caseId/steps/:stepId/response', require('../controllers/caseController').updateStepResponse);

module.exports = router;
