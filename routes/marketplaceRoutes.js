const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');
const {
    getAvailableCases,
    expressInterest,
    withdrawInterest,
    getCaseInterests,
    selectLawyer,
    getMyInterests
} = require('../controllers/marketplaceController');

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticate);

// Lawyer routes
router.get('/cases/available', authorize('lawyer'), getAvailableCases);
router.post('/cases/:caseId/interest', authorize('lawyer'), expressInterest);
router.delete('/cases/:caseId/interest', authorize('lawyer'), withdrawInterest);
router.get('/my-interests', authorize('lawyer'), getMyInterests);

// Client routes
router.get('/cases/:caseId/interests', authorize('client'), getCaseInterests);
router.post('/cases/:caseId/select-lawyer', authorize('client'), selectLawyer);

module.exports = router;
