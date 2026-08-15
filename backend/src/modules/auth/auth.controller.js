const { success } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const data = await authService.login(email, password);
  return success(res, data);
});

const me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user.id);
  return success(res, data);
});

const refresh = asyncHandler(async (req, res) => {
  const { id, email, role } = req.user;
  const data = await authService.refresh(id, email, role);
  return success(res, data);
});

const logout = asyncHandler(async (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  await authService.logout(token);
  return res.status(204).end();
});

module.exports = { login, me, refresh, logout };
