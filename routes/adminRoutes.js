const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
    getDashboardStats,
    getAllUsers,
    updateUserStatus,
    getPendingLawyers,
    verifyLawyer,
    negotiateLawyer,
    updateLawyerFee,
    getLawyerKPI,
    getAllLawyers,
    getMyProfile,
    updateMyProfile,
    getAllReviews,
    toggleReviewVisibility,
    getAllTransactions,
    getPayouts,
    generatePayouts,
    confirmPayout,
    updatePayoutBonus
} = require('../controllers/adminController');
const uploadAvatar = require('../middleware/uploadAvatar');

const router = express.Router();

// Tất cả routes đều cần authentication và admin role
router.use(authenticate);
router.use(authorize('admin'));

router.get('/dashboard/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.patch('/users/:userId/status', updateUserStatus);
router.get('/lawyers/pending', getPendingLawyers);
router.get('/lawyers', getAllLawyers);
router.patch('/lawyers/:lawyerId/verify', verifyLawyer);
router.post('/lawyers/:lawyerId/negotiate', negotiateLawyer);
router.put('/lawyers/:lawyerId/fee', updateLawyerFee);
router.get('/lawyers/kpi', getLawyerKPI);
router.get('/my-profile', getMyProfile);
router.put('/my-profile', uploadAvatar.single('avatar'), updateMyProfile);
router.get('/reviews', getAllReviews);
router.patch('/reviews/:reviewId/visibility', toggleReviewVisibility);
router.get('/transactions', getAllTransactions);

// Payout routes
router.get('/payouts', getPayouts);
router.post('/payouts/generate', generatePayouts);
router.put('/payouts/:payoutId/confirm', confirmPayout);
router.put('/payouts/:payoutId/bonus', updatePayoutBonus);

module.exports = router;
