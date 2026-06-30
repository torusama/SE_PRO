// server/auth.js
// Backend mẫu cho chức năng Đăng nhập / Đăng ký, khớp với bảng `users`
// và `refresh_tokens` trong DBase.sql.
//
// Cài đặt:
//   npm i express pg bcrypt jsonwebtoken cors dotenv
//
// .env cần có:
//   DATABASE_URL=postgresql://user:pass@localhost:5432/cemetery_db
//   JWT_SECRET=mot_chuoi_bi_mat_du_dai
//   JWT_EXPIRES_IN=1d

const express = require('express')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d'

function signToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

function publicUser(row) {
  // Không bao giờ trả password_hash về frontend
  const { password_hash, ...rest } = row
  return rest
}

// ---------------------------------------------------------------
// POST /api/auth/register
// body: { full_name, email, password }
// Đăng ký công khai LUÔN tạo tài khoản role = 'Customer'.
// Không tin trường `role` từ client (nếu có gửi lên) để tránh
// trường hợp gọi thẳng API tự đăng ký làm Admin.
// Muốn tạo tài khoản Admin -> dùng route /api/auth/register-admin
// bên dưới, route này yêu cầu phải đang đăng nhập bằng 1 admin khác.
// ---------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
    }

    const existing = await pool.query(
      'SELECT user_id FROM users WHERE email = $1 AND is_deleted = FALSE',
      [email]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const safeRole = 'Customer'

    const insert = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, role, full_name, created_at`,
      [email, passwordHash, safeRole, full_name]
    )

    const user = insert.rows[0]
    const token = signToken(user)

    return res.status(201).json({ user: publicUser(user), token })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại sau.' })
  }
})

// ---------------------------------------------------------------
// POST /api/auth/login
// body: { email, password }
// ---------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' })
    }

    const result = await pool.query(
      `SELECT user_id, email, password_hash, role, full_name, is_active
       FROM users
       WHERE email = $1 AND is_deleted = FALSE`,
      [email]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' })
    }

    const user = result.rows[0]

    if (!user.is_active) {
      return res.status(403).json({ message: 'Tài khoản đã bị khoá.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' })
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE user_id = $1', [
      user.user_id,
    ])

    const token = signToken(user)
    return res.json({ user: publicUser(user), token })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại sau.' })
  }
})

// ---------------------------------------------------------------
// Middleware xác thực JWT — dùng cho các route cần đăng nhập
// ---------------------------------------------------------------
function authMiddleware(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Chưa đăng nhập.' })
  }
  try {
    const payload = jwt.verify(header.split(' ')[1], JWT_SECRET)
    req.userId = payload.user_id
    req.userRole = payload.role
    next()
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn.' })
  }
}

// requireAdmin — chặn nếu user đã đăng nhập nhưng không phải Admin
// (dùng sau authMiddleware, để bảo vệ các route chỉ dành cho admin)
function requireAdmin(req, res, next) {
  if (req.userRole !== 'Admin') {
    return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' })
  }
  next()
}

// GET /api/auth/me — kiểm tra token còn hợp lệ + lấy thông tin user hiện tại
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const result = await pool.query(
    'SELECT user_id, email, role, full_name FROM users WHERE user_id = $1',
    [req.userId]
  )
  if (result.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy user.' })
  res.json({ user: result.rows[0] })
})

// ---------------------------------------------------------------
// POST /api/auth/register-admin
// Tạo tài khoản Admin mới — CHỈ admin hiện tại mới gọi được route này.
// Đây là cách duy nhất hợp lệ để tạo thêm tài khoản quản trị viên,
// thay vì cho người dùng tự chọn role lúc đăng ký công khai.
// body: { full_name, email, password }
// header: Authorization: Bearer <token của 1 admin đang đăng nhập>
// ---------------------------------------------------------------
app.post('/api/auth/register-admin', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { full_name, email, password } = req.body
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc.' })
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
    }

    const existing = await pool.query(
      'SELECT user_id FROM users WHERE email = $1 AND is_deleted = FALSE',
      [email]
    )
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email đã được sử dụng.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const insert = await pool.query(
      `INSERT INTO users (email, password_hash, role, full_name)
       VALUES ($1, $2, 'Admin', $3)
       RETURNING user_id, email, role, full_name, created_at`,
      [email, passwordHash, full_name]
    )

    return res.status(201).json({ user: publicUser(insert.rows[0]) })
  } catch (err) {
    console.error('Register admin error:', err)
    return res.status(500).json({ message: 'Lỗi máy chủ, vui lòng thử lại sau.' })
  }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Auth server chạy tại http://localhost:${PORT}`))

module.exports = { app, authMiddleware, requireAdmin }