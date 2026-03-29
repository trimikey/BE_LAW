const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const protect = require('../middleware/auth');

router.post('/video-call/momo/ipn', messageController.momoIpn);
router.get('/conversations', protect, messageController.getConversations);
router.get('/history/:partnerId', protect, messageController.getHistory);
router.patch('/read/:partnerId', protect, messageController.markConversationAsRead);
router.get('/video-call/quota/:partnerId', protect, messageController.getVideoCallQuota);
router.post('/video-call/purchase/:partnerId', protect, messageController.purchaseVideoCallPackage);
router.post('/video-call/payos/confirm', messageController.confirmPayOSVideoCallPayment);
router.post('/video-call/momo/confirm', messageController.confirmMomoVideoCallPayment);

module.exports = router;
