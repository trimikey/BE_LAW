const express = require('express');
const authenticate = require('../middleware/auth');
const { 
    uploadFile, 
    uploadMultipleFiles, 
    getDocuments, 
    downloadFile, 
    deleteFile,
    verifyDocument
} = require('../controllers/documentController');

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authenticate);

// Upload single file
router.post('/upload', uploadFile);

// Upload multiple files
router.post('/upload/multiple', uploadMultipleFiles);

// Lấy danh sách documents
router.get('/', getDocuments);

// Download file
router.get('/:documentId/download', downloadFile);

// Xóa file
router.delete('/:documentId', deleteFile);

// Verify document
router.patch('/:documentId/verify', verifyDocument);

module.exports = router;
