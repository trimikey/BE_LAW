const { Document, Case, Consultation, User, Role } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Helper function để lấy role name
const getUserRole = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'role_id']
        });

        if (!user || !user.role_id) {
            return null;
        }

        const role = await Role.findByPk(user.role_id, {
            attributes: ['name']
        });

        return role?.name || null;
    } catch (error) {
        console.error('Error getting user role:', error);
        return null;
    }
};

// Cấu hình multer cho file upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Loại file không được hỗ trợ. Chỉ chấp nhận: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX'), false);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB
    },
    fileFilter
});

// Upload single file
const uploadSingle = upload.single('file');

// Upload multiple files
const uploadMultiple = upload.array('files', 10);

// Upload file
const uploadFile = async (req, res) => {
    try {
        uploadSingle(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn file để upload'
                });
            }

            const { caseId, consultationId, caseStepId, category, documentType, description, isOriginal } = req.body;
            const userId = req.user.id;

            // Validate: phải có caseId hoặc consultationId
            if (!caseId && !consultationId) {
                // Xóa file đã upload
                await fs.unlink(req.file.path);
                return res.status(400).json({
                    success: false,
                    message: 'Phải có caseId hoặc consultationId'
                });
            }

            // Kiểm tra quyền truy cập case (nếu có)
            if (caseId) {
                const caseRecord = await Case.findOne({
                    where: { id: caseId }
                });
                if (!caseRecord) {
                    await fs.unlink(req.file.path);
                    return res.status(404).json({
                        success: false,
                        message: 'Không tìm thấy vụ việc'
                    });
                }
                // Client chỉ upload vào case của mình, lawyer chỉ upload vào case được gán
                const userRole = await getUserRole(userId);
                if (!userRole) {
                    await fs.unlink(req.file.path);
                    return res.status(403).json({
                        success: false,
                        message: 'Không tìm thấy quyền của người dùng'
                    });
                }
                if (userRole === 'client' && caseRecord.client_id !== userId) {
                    await fs.unlink(req.file.path);
                    return res.status(403).json({
                        success: false,
                        message: 'Không có quyền upload file vào vụ việc này'
                    });
                }
                if (userRole === 'lawyer' && caseRecord.lawyer_id !== userId) {
                    await fs.unlink(req.file.path);
                    return res.status(403).json({
                        success: false,
                        message: 'Không có quyền upload file vào vụ việc này'
                    });
                }
            }

            // Tạo document record
            const document = await Document.create({
                case_id: caseId || null,
                consultation_id: consultationId || null,
                case_step_id: caseStepId || null,
                uploaded_by: userId,
                file_name: req.file.originalname,
                file_path: req.file.path,
                file_url: null, // Có thể thêm cloud storage URL sau
                file_type: req.file.mimetype,
                file_size: req.file.size,
                category: category || 'other',
                document_type: documentType || null,
                is_original: isOriginal === 'true' || isOriginal === true,
                description: description || null,
                version: 1
            });

            res.status(201).json({
                success: true,
                message: 'Upload file thành công',
                data: { document }
            });
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload file'
        });
    }
};

// Upload multiple files
const uploadMultipleFiles = async (req, res) => {
    try {
        uploadMultiple(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng chọn ít nhất một file'
                });
            }

            const { caseId, consultationId, caseStepId, category } = req.body;
            const userId = req.user.id;

            if (!caseId && !consultationId) {
                // Xóa tất cả files đã upload
                await Promise.all(req.files.map(file => fs.unlink(file.path)));
                return res.status(400).json({
                    success: false,
                    message: 'Phải có caseId hoặc consultationId'
                });
            }

            // Tạo documents
            const documents = await Promise.all(
                req.files.map(file =>
                    Document.create({
                        case_id: caseId || null,
                        consultation_id: consultationId || null,
                        case_step_id: caseStepId || null,
                        uploaded_by: userId,
                        file_name: file.originalname,
                        file_path: file.path,
                        file_type: file.mimetype,
                        file_size: file.size,
                        category: category || 'other',
                        version: 1
                    })
                )
            );

            res.status(201).json({
                success: true,
                message: `Upload ${documents.length} file thành công`,
                data: { documents }
            });
        });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi upload files'
        });
    }
};

// Lấy danh sách documents
const getDocuments = async (req, res) => {
    try {
        const { caseId, consultationId, category, isOriginal } = req.query;
        const userId = req.user.id;
        const userRole = await getUserRole(userId);
        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const where = {};
        if (caseId) where.case_id = caseId;
        if (consultationId) where.consultation_id = consultationId;
        if (category) where.category = category;
        if (isOriginal !== undefined) where.is_original = isOriginal === 'true';

        // Kiểm tra quyền truy cập
        if (caseId) {
            const caseRecord = await Case.findOne({ where: { id: caseId } });
            if (!caseRecord) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy vụ việc'
                });
            }
            if (userRole === 'client' && caseRecord.client_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền truy cập'
                });
            }
            if (userRole === 'lawyer' && caseRecord.lawyer_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền truy cập'
                });
            }
        }

        const documents = await Document.findAll({
            where,
            include: [
                {
                    model: User,
                    as: 'uploader',
                    attributes: ['id', 'full_name', 'email']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: { documents }
        });
    } catch (error) {
        console.error('Error getting documents:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách file'
        });
    }
};

// Download file
const downloadFile = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;
        const userRole = await getUserRole(userId);
        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const document = await Document.findOne({
            where: { id: documentId },
            include: [
                { model: Case, as: 'case' },
                { model: Consultation, as: 'consultation' }
            ]
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy file'
            });
        }

        // Kiểm tra quyền truy cập
        if (document.case_id) {
            const caseRecord = document.case;
            if (userRole === 'client' && caseRecord.client_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền truy cập file này'
                });
            }
            if (userRole === 'lawyer' && caseRecord.lawyer_id !== userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền truy cập file này'
                });
            }
        }

        // Kiểm tra file tồn tại
        try {
            await fs.access(document.file_path);
        } catch {
            return res.status(404).json({
                success: false,
                message: 'File không tồn tại trên server'
            });
        }

        res.download(document.file_path, document.file_name);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải file'
        });
    }
};

// Xóa file
const deleteFile = async (req, res) => {
    try {
        const { documentId } = req.params;
        const userId = req.user.id;
        const userRole = await getUserRole(userId);
        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        const document = await Document.findOne({
            where: { id: documentId },
            include: [{ model: Case, as: 'case' }]
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy file'
            });
        }

        // Chỉ người upload hoặc admin mới xóa được
        if (document.uploaded_by !== userId && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xóa file này'
            });
        }

        // Xóa file trên disk
        try {
            await fs.unlink(document.file_path);
        } catch (error) {
            console.error('Error deleting file from disk:', error);
        }

        // Xóa record
        await document.destroy();

        res.json({
            success: true,
            message: 'Xóa file thành công'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xóa file'
        });
    }
};

// Verify document
const verifyDocument = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { isVerified } = req.body;
        const userId = req.user.id;
        const userRole = await getUserRole(userId);
        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: 'Không tìm thấy quyền của người dùng'
            });
        }

        // Chỉ lawyer và admin mới verify được
        if (userRole !== 'lawyer' && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xác thực file'
            });
        }

        const document = await Document.findOne({
            where: { id: documentId }
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy file'
            });
        }

        await document.update({
            is_verified: isVerified,
            verified_by: isVerified ? userId : null,
            verified_at: isVerified ? new Date() : null
        });

        res.json({
            success: true,
            message: isVerified ? 'Xác thực file thành công' : 'Hủy xác thực file thành công',
            data: { document }
        });
    } catch (error) {
        console.error('Error verifying document:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xác thực file'
        });
    }
};

module.exports = {
    uploadFile,
    uploadMultipleFiles,
    getDocuments,
    downloadFile,
    deleteFile,
    verifyDocument
};
