const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(process.cwd(), 'uploads/avatars');

// 👉 TỰ ĐỘNG TẠO FOLDER NẾU CHƯA CÓ
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const uploadAvatar = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB for avatars
    },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowed.includes(ext)) {
            return cb(new Error('File không hợp lệ (JPG, PNG, WEBP)'));
        }
        cb(null, true);
    }
});

module.exports = uploadAvatar;
