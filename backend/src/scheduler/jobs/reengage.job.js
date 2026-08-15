const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const {
  getSetting,
  findTemplate,
  createVoucher,
  issueVoucher,
  renderLogAndDispatch,
} = require('../helpers');

const runReengageJob = async () => {
  const shopName = await getSetting('shop_name', 'TAP Photobooth');
  const year = new Date().getFullYear().toString();

  // last_visit_at < now - 30 days. The .lt() filter excludes NULL
  // (NULL < x evaluates to NULL/false in PostgreSQL), so customers who
  // have never visited are automatically skipped as required.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, zalo_id, last_visit_at')
    .eq('status', 'active')
    .is('deleted_at', null)
    .lt('last_visit_at', cutoff.toISOString());

  if (error) {
    throw new Error(`Reengage job: query failed: ${error.message}`);
  }

  const customers = data || [];
  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    try {
      // Prefer Zalo template; fall back to email if none configured.
      let template = await findTemplate('promo', 'zalo');
      if (!template) {
        template = await findTemplate('promo', 'email');
      }
      if (!template) {
        logger.warn(
          `Reengage job: no active promo template, skipping customer ${customer.id}`,
        );
        failed++;
        continue;
      }

      const { voucher, expiresAt } = await createVoucher({
        prefix: 'TAP-RG-',
        name: `Reengage Voucher ${year} - ${customer.full_name}`,
        type: 'promo',
        discountPercent: 20,
        validDays: 14,
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
        `Reengage job: customer ${customer.id} failed: ${err.message}`,
      );
    }
  }

  logger.info(
    `Reengage job: processed ${customers.length} customers, ${sent} sent, ${failed} failed`,
  );
  return { processed: customers.length, sent, failed };
};

module.exports = { runReengageJob };
