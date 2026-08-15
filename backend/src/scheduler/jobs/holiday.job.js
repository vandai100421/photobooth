const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const {
  getSetting,
  findTemplate,
  findTemplateById,
  createVoucher,
  issueVoucher,
  renderLogAndDispatch,
} = require('../helpers');

// Returns today's date as MM-DD string to match holidays.date (VARCHAR(5)).
const todayMMdd = () => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

// Resolve the message template for a holiday. Priority:
//   1. holiday.template_id (if set and active)
//   2. occasion='promo' on zalo, then email (generic fallback)
const resolveHolidayTemplate = async (holiday) => {
  if (holiday.template_id) {
    const tmpl = await findTemplateById(holiday.template_id);
    if (tmpl) {
      return tmpl;
    }
    logger.warn(
      `Holiday job: template_id ${holiday.template_id} not found or inactive, using fallback`,
    );
  }
  let tmpl = await findTemplate('promo', 'zalo');
  if (!tmpl) {
    tmpl = await findTemplate('promo', 'email');
  }
  return tmpl;
};

const runHolidayJob = async () => {
  const mmdd = todayMMdd();
  const year = new Date().getFullYear();
  const shopName = await getSetting('shop_name', 'TAP Photobooth');

  // holidays.date is VARCHAR MM-DD, so we can filter directly.
  const { data, error } = await supabase
    .from('holidays')
    .select('id, name, date, is_recurring, specific_year, template_id')
    .eq('is_active', true)
    .eq('date', mmdd);

  if (error) {
    throw new Error(`Holiday job: query failed: ${error.message}`);
  }

  // For non-recurring holidays, specific_year must match the current year.
  const holidays = (data || []).filter((h) =>
    h.is_recurring ? true : h.specific_year === year,
  );

  if (holidays.length === 0) {
    logger.info('Holiday job: no holidays today');
    return { holiday: null, processed: 0, sent: 0, failed: 0 };
  }

  // Process the first matching holiday (one broadcast per day is enough).
  const holiday = holidays[0];
  const yearStr = year.toString();

  const template = await resolveHolidayTemplate(holiday);
  if (!template) {
    logger.warn(
      `Holiday job: no template for holiday ${holiday.name}, skipping`,
    );
    return { holiday: holiday.name, processed: 0, sent: 0, failed: 0 };
  }

  // One shared voucher definition, issued to every active customer.
  const { voucher, expiresAt } = await createVoucher({
    prefix: 'TAP-HOL-',
    name: `Holiday Voucher - ${holiday.name} ${yearStr}`,
    type: 'holiday',
    discountPercent: 30,
    validDays: 14,
  });

  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, zalo_id')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (cErr) {
    throw new Error(`Holiday job: customer query failed: ${cErr.message}`);
  }

  let sent = 0;
  let failed = 0;
  const list = customers || [];

  for (const customer of list) {
    try {
      await issueVoucher(customer.id, voucher.id, expiresAt);

      const result = await renderLogAndDispatch({
        customer,
        template,
        voucherId: voucher.id,
        vars: {
          customer_name: customer.full_name,
          voucher_code: voucher.code,
          shop_name: shopName,
          year: yearStr,
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
        `Holiday job: customer ${customer.id} failed: ${err.message}`,
      );
    }
  }

  logger.info(
    `Holiday job: holiday=${holiday.name}, processed ${list.length} customers, ${sent} sent, ${failed} failed`,
  );
  return {
    holiday: holiday.name,
    processed: list.length,
    sent,
    failed,
  };
};

module.exports = { runHolidayJob };
