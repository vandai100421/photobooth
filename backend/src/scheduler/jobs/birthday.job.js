const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const {
  getSetting,
  findTemplate,
  createVoucher,
  issueVoucher,
  renderLogAndDispatch,
} = require('../helpers');

// Returns today's date as MM-DD string to match the month-day portion
// of customers.birthday (DATE column, formatted YYYY-MM-DD).
const todayMMdd = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

const runBirthdayJob = async () => {
  const mmdd = todayMMdd();
  const shopName = await getSetting('shop_name', 'TAP Photobooth');
  const expiryDaysRaw = await getSetting('voucher_expiry_days', '7');
  const expiryDays = parseInt(expiryDaysRaw, 10) || 7;
  const year = new Date().getFullYear().toString();

  // DATE columns cannot be LIKE-filtered through Supabase, so we fetch
  // all active customers with a birthday then filter MM-DD in JS.
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, zalo_id, birthday')
    .eq('status', 'active')
    .is('deleted_at', null)
    .not('birthday', 'is', null);

  if (error) {
    throw new Error(`Birthday job: query failed: ${error.message}`);
  }

  const customers = (data || []).filter(
    (c) => c.birthday && c.birthday.slice(5, 10) === mmdd,
  );

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    try {
      // Prefer Zalo template; fall back to email if none configured.
      let template = await findTemplate('birthday', 'zalo');
      if (!template) {
        template = await findTemplate('birthday', 'email');
      }
      if (!template) {
        logger.warn(
          `Birthday job: no active birthday template, skipping customer ${customer.id}`,
        );
        failed++;
        continue;
      }

      const { voucher, expiresAt } = await createVoucher({
        prefix: 'TAP-BDAY-',
        name: `Birthday Voucher ${year} - ${customer.full_name}`,
        type: 'birthday',
        discountPercent: 50,
        validDays: expiryDays,
      });

      await issueVoucher(customer.id, voucher.id, expiresAt);

      const result = await renderLogAndDispatch({
        customer,
        template,
        voucherId: voucher.id,
        vars: {
          customer_name: customer.full_name,
          voucher_code: voucher.code,
          shop_name: shopName,
          year,
        },
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      logger.error(
        `Birthday job: customer ${customer.id} failed: ${err.message}`,
      );
    }
  }

  logger.info(
    `Birthday job: processed ${customers.length} customers, ${sent} sent, ${failed} failed`,
  );
  return { processed: customers.length, sent, failed };
};

module.exports = { runBirthdayJob };
