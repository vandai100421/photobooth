// Template rendering: replaces {{key}} placeholders with provided values.
// Unknown placeholders are left intact so they remain visible for debugging.
// Usage: render('Hi {{customer_name}}', { customer_name: 'Nguyễn Văn A' })
const render = (body, vars = {}) => {
  if (typeof body !== 'string') return body;
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      const val = vars[key];
      return val === null || val === undefined ? '' : String(val);
    }
    return match;
  });
};

module.exports = { render };
