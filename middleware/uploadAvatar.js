const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinary');

const allowed = ['.jpg', '.jpeg', '.png', '.webp'];

const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowed.includes(ext)) {
            return cb(new Error('File khong hop le (JPG, PNG, WEBP)'));
        }

        cb(null, true);
    }
});

const uploadBufferToCloudinary = (fileBuffer, originalname) => new Promise((resolve, reject) => {
    const ext = path.extname(originalname).toLowerCase().replace('.', '') || 'jpg';
    const uploadStream = cloudinary.uploader.upload_stream(
        {
            folder: 'lawyer-platform/avatars',
            public_id: `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
            format: ext,
            resource_type: 'image'
        },
        (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        }
    );

    uploadStream.end(fileBuffer);
});

module.exports = {
    single(fieldName) {
        const handleSingle = multerUpload.single(fieldName);

        return (req, res, next) => {
            handleSingle(req, res, async (error) => {
                if (error || !req.file) {
                    next(error);
                    return;
                }

                try {
                    const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
                    req.file.path = result.secure_url;
                    req.file.filename = result.public_id;
                    req.file.cloudinary = result;
                    next();
                } catch (uploadError) {
                    next(uploadError);
                }
            });
        };
    }
};
