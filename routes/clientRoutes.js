const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
    getDashboardStats,
    getMyCases,
    createCase,
    getMyConsultations,
    searchLawyers,
    bookConsultation,
    getLawyerAvailability,
    bookConsultationFromSlot,
    updateCaseIntake,
    getMyProfile,
    updateMyProfile,
    createReview,
    getMyTransactions,
    getMyReviews,
    deleteCase,
    archiveCase,
    restoreCase
} = require('../controllers/clientController');
const { getLawyers, getLawyerById } = require('../controllers/lawyerController');
const uploadAvatar = require('../middleware/uploadAvatar');

const router = express.Router();
router.get('/lawyers', getLawyers); // public
router.get('/lawyers/:id', getLawyerById);

// Tất cả routes đều cần authentication và client role
router.use(authenticate);
router.use(authorize('client'));

router.get('/dashboard/stats', getDashboardStats);
router.get('/cases', getMyCases);
router.post('/cases', createCase);
router.delete('/cases/:caseId', deleteCase);
router.patch('/cases/:caseId/archive', archiveCase);
router.patch('/cases/:caseId/restore', restoreCase);
router.patch('/cases/:caseId/intake', updateCaseIntake);
router.get('/consultations', getMyConsultations);
router.get('/transactions', getMyTransactions);
router.get('/reviews', getMyReviews);
router.get('/lawyers/search', searchLawyers);
router.get('/lawyers/:lawyerId/availability', getLawyerAvailability);
router.post('/consultations/book', bookConsultation);
router.post('/consultations/book-from-slot', bookConsultationFromSlot);
router.get('/my-profile', getMyProfile);
router.put('/my-profile', uploadAvatar.single('avatar'), updateMyProfile);
router.post('/lawyers/:lawyerId/reviews', createReview);

module.exports = router;
