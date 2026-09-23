const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Client dùng anon key, dành RIÊNG cho thao tác xác thực phía user:
// signInWithPassword / getUser / signOut.
//
// Lý do tách riêng: nếu các thao tác này chạy trên client service-role dùng
// chung, client sẽ giữ lại session của user vừa đăng nhập — từ đó mọi truy vấn
// dữ liệu tiếp theo của backend bị chạy với JWT của user (role `authenticated`)
// thay vì service_role, gây ra lỗi "permission denied" trên các bảng không grant
// quyền ghi cho authenticated.
const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = authClient;
