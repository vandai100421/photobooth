const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// Lazily-instantiated SMTP transporter. Created on first use so missing
// Gmail env vars only fail when email is actually attempted.
let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
    throw new AppError(
      'Gmail SMTP credentials are not configured (GMAIL_USER / GMAIL_APP_PASSWORD)',
      500,
    );
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.GMAIL_USER,
      pass: env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
};

// Send a plain-text email. Returns { success, messageId }.
const sendMail = async (to, subject, body) => {
  if (!to) {
    throw new AppError('sendMail requires a recipient address', 400);
  }
  if (!subject) {
    throw new AppError('sendMail requires a subject', 400);
  }
  if (!body) {
    throw new AppError('sendMail requires a body', 400);
  }

  if (env.MESSAGE_DRY_RUN) {
    logger.info(
      `gmail.service DRY-RUN sendMail to=${to} subject="${subject}"`,
    );
    return { success: true, messageId: 'dry-run' };
  }

  const t = getTransporter();
  const from = env.GMAIL_USER;

  try {
    const info = await t.sendMail({
      from,
      to,
      subject,
      text: body,
    });
    logger.info(`gmail.service sendMail to=${to} messageId=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`gmail.service sendMail failed to=${to}: ${err.message}`);
    throw new AppError(`Gmail send failed: ${err.message}`, 502);
  }
};

module.exports = {
  sendMail,
};
