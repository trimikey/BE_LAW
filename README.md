# Express.js Authentication Backend

Backend API với Express.js và MySQL, hỗ trợ đăng ký, đăng nhập, quên mật khẩu và phân quyền.

## 🚀 Tính năng

- ✅ Đăng ký tài khoản (Signup)
- ✅ Đăng nhập (Login) với JWT
- ✅ Đăng xuất (Logout)
- ✅ Quên mật khẩu (Forgot Password) - Gửi email reset
- ✅ Đặt lại mật khẩu (Reset Password)
- ✅ Refresh Token
- ✅ Phân quyền (Role-based Authorization)
  - Admin
  - Lawyer
  - Client
- ✅ Middleware xác thực (Authentication)
- ✅ Middleware phân quyền (Authorization)

## 📋 Yêu cầu

- Node.js >= 14.x
- MySQL >= 5.7 hoặc MariaDB >= 10.3
- npm hoặc yarn

## 🔧 Cài đặt

### 1. Clone và cài đặt dependencies

```bash
cd backend
npm install
```

### 2. Cấu hình môi trường

Sao chép file `.env.example` thành `.env` và điền thông tin:

```bash
cp .env.example .env
```

Chỉnh sửa file `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lawyer_platform_db

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRE=7d

# Email (tùy chọn - nếu không có sẽ log ra console)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@lawyerplatform.com

FRONTEND_URL=http://localhost:3001
```

**Lưu ý về Gmail App Password:**
- Nếu dùng Gmail, bạn cần tạo "App Password" tại: https://myaccount.google.com/apppasswords
- Không dùng mật khẩu Gmail thông thường

### 3. Tạo database

Chạy file SQL để tạo database và tables:

```bash
mysql -u root -p < database.sql
```

Hoặc mở MySQL và chạy:

```sql
source database.sql;
```

### 4. Chạy server

**Development mode (với nodemon):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📚 API Endpoints

### Public Routes

#### 1. Đăng ký
```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "Password123",
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "roleId": 3  // Optional: 1=admin, 2=lawyer, 3=client (default)
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công!",
  "data": {
    "user": {
      "id": 1,
      "email": "client@example.com",
      "full_name": "Nguyễn Văn A",
      "role_id": 3,
      "role_name": "client"
    }
  }
}
```

#### 2. Đăng nhập
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "client@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng nhập thành công!",
  "data": {
    "user": {
      "id": 1,
      "email": "client@example.com",
      "fullName": "Nguyễn Văn A",
      "roleId": 3,
      "roleName": "client"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "abc123..."
  }
}
```

#### 3. Quên mật khẩu
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "client@example.com"
}
```

#### 4. Đặt lại mật khẩu
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "newPassword": "NewPassword123"
}
```

#### 5. Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "abc123..."
}
```

#### 6. Đăng xuất
```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "abc123..."
}
```

### Protected Routes (Cần JWT Token)

#### 7. Lấy thông tin user hiện tại
```http
GET /api/auth/me
Authorization: Bearer <your_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "client@example.com",
      "full_name": "Nguyễn Văn A",
      "phone": "0912345678",
      "role_id": 3,
      "role_name": "client",
      "is_active": true,
      "email_verified": false,
      "last_login": "2025-01-15T10:30:00.000Z",
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

## 🔐 Sử dụng Middleware

### Authentication Middleware

Bảo vệ route yêu cầu đăng nhập:

```javascript
const authenticate = require('./middleware/auth');
const router = express.Router();

router.get('/profile', authenticate, (req, res) => {
    // req.user chứa thông tin user đã đăng nhập
    res.json({ user: req.user });
});
```

### Authorization Middleware

Bảo vệ route theo role:

```javascript
const authenticate = require('./middleware/auth');
const authorize = require('./middleware/role');
const router = express.Router();

// Chỉ admin mới truy cập được
router.get('/admin/users', authenticate, authorize('admin'), (req, res) => {
    res.json({ message: 'Admin only' });
});

// Admin hoặc lawyer mới truy cập được
router.get('/cases', authenticate, authorize('admin', 'lawyer'), (req, res) => {
    res.json({ message: 'Admin or Lawyer only' });
});
```

## 🗄️ Database Schema

### Tables

1. **roles** - Vai trò người dùng
   - id, name, description

2. **users** - Người dùng
   - id, email, password (hashed), full_name, phone, role_id, is_active, email_verified, last_login

3. **password_resets** - Token đặt lại mật khẩu
   - id, user_id, token, expires_at, used

4. **refresh_tokens** - Refresh tokens
   - id, user_id, token, expires_at

## 🔒 Bảo mật

- ✅ Mật khẩu được hash bằng bcrypt
- ✅ JWT token với expiration
- ✅ Refresh token mechanism
- ✅ Email validation
- ✅ Password strength validation
- ✅ SQL injection protection (prepared statements)
- ✅ CORS configuration
- ✅ Rate limiting (có thể thêm)

## 🧪 Testing với Postman/Thunder Client

1. **Đăng ký:**
   - POST `http://localhost:3000/api/auth/signup`
   - Body: JSON với email, password, fullName

2. **Đăng nhập:**
   - POST `http://localhost:3000/api/auth/login`
   - Copy `token` từ response

3. **Lấy thông tin user:**
   - GET `http://localhost:3000/api/auth/me`
   - Header: `Authorization: Bearer <token>`

## 📝 Notes

- Mật khẩu mặc định của admin: Cần thay đổi sau khi deploy
- Email reset password: Nếu không cấu hình email, link sẽ được log ra console
- JWT_SECRET: **PHẢI** thay đổi trong production
- Refresh token: Tự động xóa sau 30 ngày

## 🐛 Troubleshooting

**Lỗi kết nối MySQL:**
- Kiểm tra MySQL đã chạy chưa
- Kiểm tra thông tin trong `.env` (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)

**Lỗi email:**
- Nếu dùng Gmail, cần tạo App Password
- Nếu không cấu hình email, hệ thống sẽ log link reset ra console

**Lỗi JWT:**
- Kiểm tra JWT_SECRET trong `.env`
- Kiểm tra token có hết hạn không

## 📄 License

ISC
