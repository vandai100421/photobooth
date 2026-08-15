const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const employeesRouter = require('./modules/employees/employees.routes');
const customersRouter = require('./modules/customers/customers.routes');
const bookingsRouter = require('./modules/bookings/bookings.routes');
const vouchersRouter = require('./modules/vouchers/vouchers.routes');
const postsRouter = require('./modules/posts/posts.routes');
const holidaysRouter = require('./modules/holidays/holidays.routes');
const uploadRouter = require('./modules/upload/upload.routes');
const templatesRouter = require('./modules/templates/templates.routes');
const messagesRouter = require('./modules/messages/messages.routes');
const webhooksRouter = require('./modules/webhooks/webhooks.routes');
const settingsRouter = require('./modules/settings/settings.routes');
const dashboardRouter = require('./modules/dashboard/dashboard.routes');
const scheduleRouter = require('./modules/schedule/schedule.routes');
const rewardsRouter = require('./modules/rewards/rewards.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// 100 req/phút/IP theo DEVELOPMENT_RULES.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please slow down' },
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/employees', employeesRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/bookings', bookingsRouter);
app.use('/api/v1/vouchers', vouchersRouter);
app.use('/api/v1/posts', postsRouter);
app.use('/api/v1/holidays', holidaysRouter);
app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1/templates', templatesRouter);
app.use('/api/v1/messages', messagesRouter);
app.use('/api/v1/webhooks', webhooksRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/schedule', scheduleRouter);
app.use('/api/v1/rewards', rewardsRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
