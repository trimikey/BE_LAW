const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
    getDashboardStats,
    getMyCases,
    searchClients,
    createCase,
    updateCaseStatus,
    getMyConsultations,
    updateConsultationStatus,
    getMyAvailability,
    createAvailability,
    updateAvailability,
    deleteAvailability,
    getMyClients,
    getRevenueByClient,
    getMyOrders,
    getLawyers,
    getMyProfile,
    updateMyProfile,
    createClient,
    restoreAvailabilitySlot,
    getMyReviews,
    archiveClient,
    restoreClient
} = require('../controllers/lawyerController');
const uploadAvatar = require('../middleware/uploadAvatar');
const router = express.Router();
// Tất cả routes đều cần authentication và lawyer role
router.use(authenticate);
router.use(authorize('lawyer'));

router.get('/dashboard/stats', getDashboardStats);
router.get('/cases', getMyCases);
router.post('/cases', createCase);
router.get('/search-clients', searchClients);
router.patch('/cases/:caseId/status', updateCaseStatus);
router.get('/consultations', getMyConsultations);
router.patch('/consultations/:consultationId/status', updateConsultationStatus);
router.get('/availability', getMyAvailability);
router.post('/availability', createAvailability);
router.patch('/availability/:slotId', updateAvailability);
router.patch('/availability/:slotId/restore', restoreAvailabilitySlot);
router.delete('/availability/:slotId', deleteAvailability);
router.post('/clients', createClient);
router.get('/clients', getMyClients);
router.get('/revenue-by-client', getRevenueByClient);
router.get('/orders', getMyOrders);
router.get('/lawyers', getLawyers);
router.get('/my-profile', getMyProfile);
router.put('/my-profile', uploadAvatar.single('avatar'), updateMyProfile);
router.get('/reviews', getMyReviews);
router.patch('/clients/:id/archive', archiveClient);
router.patch('/clients/:id/restore', restoreClient);
module.exports = router;
