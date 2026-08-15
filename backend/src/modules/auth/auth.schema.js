const { z } = require('zod');

// Đăng nhập chấp nhận email HOẶC SĐT. Validate ở service sẽ phân loại.
const loginSchema = {
  body: z.object({
    email: z.string().min(3, 'Vui lòng nhập email hoặc SĐT'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
};

const refreshSchema = {
  body: z.object({
    token: z.string().min(1, 'Token is required').optional(),
  }).optional(),
};

module.exports = { loginSchema, refreshSchema };
