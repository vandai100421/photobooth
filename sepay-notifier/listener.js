const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');

function speak(text) {
  const cmd = `spd-say "${text.replace(/"/g, '\\"')}" 2>/dev/null || espeak-ng "${text.replace(/"/g, '\\"')}" 2>/dev/null || espeak "${text.replace(/"/g, '\\"')}" 2>/dev/null || say "${text}" 2>/dev/null`;
  exec(cmd, (err) => {
    if (err) console.warn('TTS failed:', err.message);
  });
}

function playBeep() {
  const cmd = `paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || aplay /usr/share/sounds/alsa/Front_Center.wav 2>/dev/null || echo -e '\\a'`;
  exec(cmd);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Missing config.json. Create it first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function loadState() {
  if (fs.existsSync(STATE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    } catch (e) {
      return { lastId: 0 };
    }
  }
  return { lastId: 0 };
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchTransactions(config) {
  const data = `draw=6&columns%5B0%5D%5Bdata%5D=id&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=true&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=transaction_date&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=false&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=sub_account&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=code&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=reference_number&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=true&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B9%5D%5Bdata%5D=&columns%5B9%5D%5Bname%5D=&columns%5B9%5D%5Bsearchable%5D=true&columns%5B9%5D%5Borderable%5D=false&columns%5B9%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B9%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=1&order%5B0%5D%5Bdir%5D=desc&start=0&length=10&search%5Bvalue%5D=&bank_account_id=${config.bank_account_id}&date_range=&transaction_type=in&code_filter=&amount_range=&csrf_main=${config.csrf_main}`;

  const res = await axios.request({
    method: 'post',
    url: 'https://my.sepay.vn/transactions/ajax_transactions_v3',
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'origin': 'https://my.sepay.vn',
      'referer': `https://my.sepay.vn/transactions?bank_account_id=${config.bank_account_id}&transaction_type=in%2Cout`,
      'user-agent': config.user_agent || 'Mozilla/5.0',
      'x-requested-with': 'XMLHttpRequest',
      'Cookie': config.cookie,
    },
    data,
    timeout: 15000,
  });
  return res.data;
}

// Extract amount/content/account defensively across the possible field
// names SePay's DataTables endpoint may return.
function extractTx(tx) {
  const amount =
    tx.amount_in ?? tx.amountIn ?? tx.credit ?? tx.amount ?? 0;
  const content =
    tx.transaction_content ??
    tx.content ??
    tx.description ??
    tx.code ??
    '';
  const acc =
    tx.account_number ??
    tx.sub_account ??
    tx.bank_account ??
    tx.reference_number ??
    '';
  return { amount: Number(amount) || 0, content: String(content), acc: String(acc) };
}

async function main() {
  const config = loadConfig();
  const state = loadState();
  const debug = process.argv.includes('--debug');

  console.log(
    `[SePay Notifier] Started. Polling every ${config.interval_sec || 10}s...`,
  );

  if (debug) {
    const raw = await fetchTransactions(config);
    console.log('[DEBUG] Raw response:');
    console.log(JSON.stringify(raw, null, 2));
    return;
  }

  speak('Trình nghe SePay đã khởi động');

  setInterval(async () => {
    try {
      const data = await fetchTransactions(config);
      const txs = data?.data || [];
      if (txs.length === 0) return;

      const newTxs = txs
        .filter((t) => parseInt(t.id, 10) > state.lastId)
        .reverse();
      if (newTxs.length > 0) {
        state.lastId = Math.max(
          state.lastId,
          ...newTxs.map((t) => parseInt(t.id, 10)),
        );
        saveState(state);

        for (const tx of newTxs) {
          const { amount, content, acc } = extractTx(tx);
          const msg = `Có tiền vào: ${amount.toLocaleString('vi-VN')} đồng. Nội dung: ${content}. Tài khoản: ${acc}`;
          console.log('[NEW]', msg);
          playBeep();
          speak(msg);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err.response?.status || '', err.message);
    }
  }, (config.interval_sec || 10) * 1000);
}

main();
