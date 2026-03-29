const express = require('express');
const router = express.Router();
const {
    createInquiry,
    getInquiries,
    updateInquiryStatus,
    getMyInquiries
} = require('../controllers/inquiryController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

// Public route to submit inquiry
router.post('/', createInquiry);

// Protected routes to manage inquiries
router.get('/my-inquiries', authenticate, getMyInquiries);
router.get('/', authenticate, authorize('lawyer', 'admin'), getInquiries);
router.patch('/:id', authenticate, authorize('lawyer', 'admin'), updateInquiryStatus);

module.exports = router;
