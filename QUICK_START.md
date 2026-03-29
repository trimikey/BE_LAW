# Quick Start Guide

## 🚀 Chạy Backend

### 1. Kiểm tra .env file

Đảm bảo file `.env` đã được tạo với thông tin đúng:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lawyer_platform_db

JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRE=7d

FRONTEND_URL=http://localhost:3000
```

### 2. Chạy migrations (nếu chưa chạy)

```bash
cd backend
npm run db:migrate
```

### 3. Chạy seeders (nếu chưa chạy)

```bash
npm run db:seed
```

### 4. Khởi động server

```bash
npm run dev
```

Backend sẽ chạy tại: `http://localhost:3001`

## 🔐 Tài khoản mẫu để test

Sau khi chạy seeders, bạn có thể đăng nhập với:

**Admin:**
- Email: `admin@lawyerplatform.com`
- Password: `Password123!`

**Lawyer:**
- Email: `lawyer1@lawyerplatform.com`
- Password: `Password123!`

**Client:**
- Email: `client1@example.com`
- Password: `Password123!`

## 🐛 Troubleshooting

### Lỗi "secretOrPrivateKey must have a value"

**Nguyên nhân:** File `.env` chưa được tạo hoặc thiếu `JWT_SECRET`.

**Giải pháp:**
1. Kiểm tra file `.env` đã tồn tại trong folder `backend/` chưa
2. Đảm bảo file `.env` có dòng: `JWT_SECRET=your_secret_key_here`
3. Nếu chưa có file `.env`, tạo file mới với nội dung:
   ```env
   PORT=3001
   NODE_ENV=development
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=lawyer_platform_db
   JWT_SECRET=lawyer_platform_jwt_secret_key_2025_change_in_production
   JWT_EXPIRE=7d
   FRONTEND_URL=http://localhost:3000
   ```
4. **Quan trọng:** Cập nhật `DB_PASSWORD` với mật khẩu MySQL của bạn
5. Restart backend server sau khi cập nhật `.env`

### Lỗi ECONNREFUSED

**Nguyên nhân:** Backend chưa chạy hoặc chạy sai port.

**Giải pháp:**
1. Kiểm tra backend đã chạy chưa: `npm run dev` trong folder `backend/`
2. Kiểm tra port 3001 có bị chiếm không
3. Kiểm tra `.env` file có đúng không

### Lỗi kết nối MySQL

**Nguyên nhân:** MySQL chưa chạy hoặc thông tin trong `.env` sai.

**Giải pháp:**
1. Kiểm tra MySQL đã chạy chưa
2. Kiểm tra thông tin trong `.env`:
   - `DB_HOST=localhost`
   - `DB_USER=root`
   - `DB_PASSWORD=your_password`
   - `DB_NAME=lawyer_platform_db`
3. Test kết nối: `mysql -u root -p`

### Lỗi đăng nhập "Email hoặc mật khẩu không đúng"

**Nguyên nhân:** 
- Seeder chưa chạy
- Password sai
- User chưa được tạo

**Giải pháp:**
1. Chạy lại seeders: `npm run db:seed`
2. Kiểm tra user trong database:
   ```sql
   SELECT email, is_active FROM users WHERE email = 'admin@lawyerplatform.com';
   ```
3. Đảm bảo dùng đúng password: `Password123!`

### Lỗi "Tài khoản của bạn đã bị khóa"

**Nguyên nhân:** User có `is_active = false`

**Giải pháp:**
- Với admin và client: `is_active` phải là `true`
- Với lawyer: Cần được admin verify trước (trừ lawyer1 và lawyer2 đã verified)

## ✅ Kiểm tra Backend đang chạy

Mở browser và truy cập: `http://localhost:3001/health`

Nếu thấy response:
```json
{
  "success": true,
  "message": "Server is running!",
  "timestamp": "..."
}
```

Thì backend đã chạy thành công!
