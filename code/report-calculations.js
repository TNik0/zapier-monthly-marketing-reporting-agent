// =====================================================================
// Monthly Marketing Report Agent — Code by Zapier step (Run JavaScript)
// ---------------------------------------------------------------------
// Rule of the project: the CODE does all the maths. The AI never
// calculates, estimates or invents a number.
//
// Zapier "Input Data":
//   rows_json     -> "Raw Rows" (JSON) from Google Sheets
//                    "Get Many Spreadsheet Rows (Advanced)", first row = 1
//   report_month  -> OPTIONAL, e.g. "2026-06" (for testing only).
//                    Leave it out for the real monthly run: the code then
//                    reports on last month (India time).
//
// Outputs: report_month, previous_month, flag, flag_reasons,
//          summary_text (for the AI), cards_html (for the email)
// =====================================================================

const CPL_ALERT_PCT = 20; // flag a channel if cost per lead rises more than 20%

// ---------- 1. Read the sheet ----------
let rows;
try { rows = JSON.parse(inputData.rows_json); }
catch (e) { throw new Error('rows_json is not valid JSON. Map the "Raw Rows" field from step 2.'); }

const header = rows[0].map(h => String(h).trim().toLowerCase());
const col = name => header.indexOf(name);

// Blank cell = null = "MISSING". Never 0, never guessed.
function num(v) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}
const text = v => (v === undefined || v === null) ? '' : String(v).trim();

const data = rows.slice(1).map(r => ({
  month: text(r[col('month')]),
  channel: text(r[col('channel')]),
  spend: num(r[col('spend_inr')]),
  impressions: num(r[col('impressions')]),
  clicks: num(r[col('clicks')]),
  leads: num(r[col('leads')]),
  notes: text(r[col('notes')])
})).filter(r => r.month && r.channel);

// ---------- 2. Work out the report month and last month ----------
// If report_month is filled in, use it (testing).
// If it's empty, use last month in India time (real monthly run).
function lastMonthIST() {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth(); // 0 = Jan, so this already equals last month's number
  if (m === 0) { m = 12; y = y - 1; }
  return y + '-' + String(m).padStart(2, '0');
}
const reportMonth = text(inputData.report_month) || lastMonthIST();

let [y, m] = reportMonth.split('-').map(Number);
m = m - 1;
if (m === 0) { m = 12; y = y - 1; }
const prevMonth = y + '-' + String(m).padStart(2, '0');

// ---------- 3. Helpers ----------
const div = (a, b) => (a === null || b === null || b === 0) ? null : a / b;
const pctChange = (now, before) => (now === null || before === null || before === 0) ? null : (now - before) / before * 100;
const rupees = v => v === null ? 'MISSING' : '₹' + Math.round(v);
const money = v => v === null ? 'MISSING' : '₹' + v.toFixed(2);
const whole = v => v === null ? 'MISSING' : String(v);
const pctText = v => v === null ? 'MISSING' : (v * 100).toFixed(2) + '%';
const change = p => p === null ? 'no comparison possible' : (p >= 0 ? '+' : '') + p.toFixed(1) + '%';
const points = (a, b) => (a === null || b === null) ? 'no comparison possible'
  : ((a - b) * 100 >= 0 ? '+' : '') + ((a - b) * 100).toFixed(2) + ' percentage points';
const sum = (arr, k) => (arr.length === 0 || arr.some(r => r[k] === null)) ? null : arr.reduce((s, r) => s + r[k], 0);

// ---------- 4. Per-channel comparison + flags ----------
const current = data.filter(r => r.month === reportMonth);
const previous = data.filter(r => r.month === prevMonth);
const flags = [];
const lines = [];

if (current.length === 0) flags.push('No data found for ' + reportMonth);

for (const now of current) {
  const ch = now.channel;
  const before = previous.find(r => r.channel === ch) || null;
  const b = before || { spend: null, impressions: null, clicks: null, leads: null, notes: '' };
  if (!before) flags.push(ch + ': no data for ' + prevMonth + ', so no comparison');

  const cplNow = div(now.spend, now.leads);
  const cplBefore = div(b.spend, b.leads);
  const cplChg = pctChange(cplNow, cplBefore);
  const ctrNow = div(now.clicks, now.impressions);
  const ctrBefore = div(b.clicks, b.impressions);

  if (now.leads === null) flags.push(ch + ': leads MISSING in ' + reportMonth + (now.notes ? ' (note: ' + now.notes + ')' : ''));
  if (before && b.leads === null) flags.push(ch + ': leads MISSING in ' + prevMonth + (b.notes ? ' (note: ' + b.notes + ')' : '') + ', so cost per lead cannot be compared');
  if (cplChg !== null && cplChg > CPL_ALERT_PCT) flags.push(ch + ': cost per lead up ' + cplChg.toFixed(1) + '% (' + money(cplBefore) + ' → ' + money(cplNow) + ')');

  lines.push(
    ch + ':\n' +
    '  Spend: ' + rupees(b.spend) + ' → ' + rupees(now.spend) + ' (' + change(pctChange(now.spend, b.spend)) + ')\n' +
    '  Leads: ' + whole(b.leads) + ' → ' + whole(now.leads) + ' (' + change(pctChange(now.leads, b.leads)) + ')\n' +
    '  Cost per lead: ' + money(cplBefore) + ' → ' + money(cplNow) + ' (' + change(cplChg) + ')\n' +
    '  Click-through rate: ' + pctText(ctrBefore) + ' → ' + pctText(ctrNow) + ' (' + points(ctrNow, ctrBefore) + ')\n' +
    '  Notes this month: ' + (now.notes || 'none') + ' | Notes last month: ' + (b.notes || 'none')
  );
}

// ---------- 5. Totals ----------
const spendNow = sum(current, 'spend'), spendBefore = sum(previous, 'spend');
const leadsNow = sum(current, 'leads'), leadsBefore = sum(previous, 'leads');
const totalLine = v => v === null ? 'INCOMPLETE (a channel is missing data)' : String(v);

const summary =
  'Report month: ' + reportMonth + ' (compared with ' + prevMonth + ')\n\n' +
  'TOTAL, all channels:\n' +
  '  Spend: ' + rupees(spendBefore) + ' → ' + rupees(spendNow) + ' (' + change(pctChange(spendNow, spendBefore)) + ')\n' +
  '  Leads: ' + totalLine(leadsBefore) + ' → ' + totalLine(leadsNow) + ' (' + change(pctChange(leadsNow, leadsBefore)) + ')\n' +
  '  Cost per lead: ' + money(div(spendBefore, leadsBefore)) + ' → ' + money(div(spendNow, leadsNow)) +
  ' (' + change(pctChange(div(spendNow, leadsNow), div(spendBefore, leadsBefore))) + ')\n\n' +
  lines.join('\n\n');

// ---------- 6. Visual email cards (built by CODE so every number is exact) ----------
const C = { card:'#FFFFFF', ink:'#1F2430', muted:'#636B78', line:'#E6E2DA', sage:'#4E7A5B', blue:'#7BA3C9', clay:'#B4553A' };
const BRANDS = { 'google search':'#4285F4', 'google call ads':'#34A853', 'meta lead ads':'#0866FF' };
const brand = ch => BRANDS[ch.toLowerCase()] || C.muted;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const inr0 = v => '₹' + Math.round(v).toLocaleString('en-IN');
const inr2 = v => '₹' + v.toFixed(2);
const val = (v, f) => v === null ? '<span style="color:'+C.clay+';">Missing</span>' : f(v);

// Arrow badge. goodWhen: 'up' (more is good), 'down' (less is good), 'neutral'
function badge(p, goodWhen) {
  if (p === null) return '<div style="font-size:12px;color:'+C.muted+';">no comparison</div>';
  const up = p >= 0;
  let color = C.muted;
  if (goodWhen === 'up') color = up ? C.sage : C.clay;
  if (goodWhen === 'down') color = up ? C.clay : C.sage;
  return '<div style="font-size:12px;font-weight:bold;color:'+color+';">'+(up ? '▲ ' : '▼ ')+Math.abs(p).toFixed(1)+'%</div>';
}

function kpi(label, valueHtml, badgeHtml, sub) {
  return '<td width="33%" valign="top" style="padding:5px;">' +
    '<div style="background:'+C.card+';border:1px solid '+C.line+';border-radius:14px;padding:16px;">' +
    '<div style="font-size:12px;color:'+C.muted+';">'+label+'</div>' +
    '<div style="font-size:24px;font-weight:bold;color:'+C.ink+';margin:6px 0 4px;">'+valueHtml+'</div>' +
    badgeHtml +
    '<div style="font-size:11px;color:'+C.muted+';margin-top:4px;">'+sub+'</div>' +
    '</div></td>';
}

// Top row: 3 totals
const cplNowT = div(spendNow, leadsNow), cplBeforeT = div(spendBefore, leadsBefore);
let html = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
  kpi('Total spend', val(spendNow, inr0), badge(pctChange(spendNow, spendBefore), 'neutral'), 'vs ' + (spendBefore === null ? '—' : inr0(spendBefore)) + ' last month') +
  kpi('Total leads', val(leadsNow, String), badge(pctChange(leadsNow, leadsBefore), 'up'), 'vs ' + (leadsBefore === null ? '—' : leadsBefore) + ' last month') +
  kpi('Cost per lead', val(cplNowT, inr2), badge(pctChange(cplNowT, cplBeforeT), 'down'), 'vs ' + (cplBeforeT === null ? '—' : inr2(cplBeforeT)) + ' last month') +
  '</tr></table>';

// One card per channel
html += '<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:'+C.muted+';margin:22px 5px 8px;">By channel</div>';
html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
for (const now of current) {
  const b = previous.find(r => r.channel === now.channel) || { spend: null, leads: null };
  const cN = div(now.spend, now.leads), cB = div(b.spend, b.leads);
  const cChg = pctChange(cN, cB);
  const alert = now.leads === null || b.leads === null || (cChg !== null && cChg > CPL_ALERT_PCT);
  const bc = brand(now.channel);
  const metric = (label, v, bdg) => '<td width="33%" valign="top"><div style="font-size:11px;color:'+C.muted+';">'+label+'</div><div style="font-size:18px;font-weight:bold;color:'+C.ink+';margin:2px 0;">'+v+'</div>'+bdg+'</td>';
  html += '<tr><td style="padding:5px;"><div style="background:'+C.card+';border:1px solid '+C.line+';border-left:5px solid '+bc+';border-radius:14px;padding:16px 18px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td><span style="display:inline-block;background:'+bc+';color:#ffffff;font-size:12px;font-weight:bold;padding:5px 12px;border-radius:999px;">'+esc(now.channel)+'</span></td>' +
    '<td align="right">' + (alert
      ? '<span style="display:inline-block;background:#F8E6E0;color:'+C.clay+';font-size:11px;font-weight:bold;padding:4px 10px;border-radius:999px;">⚠ Needs attention</span>'
      : '<span style="display:inline-block;background:#E5EFE7;color:'+C.sage+';font-size:11px;font-weight:bold;padding:4px 10px;border-radius:999px;">✓ On track</span>') +
    '</td></tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>' +
    metric('Spend', val(now.spend, inr0), badge(pctChange(now.spend, b.spend), 'neutral')) +
    metric('Leads', val(now.leads, String), badge(pctChange(now.leads, b.leads), 'up')) +
    metric('Cost per lead', val(cN, inr2), badge(cChg, 'down')) +
    '</tr></table>' +
    (now.notes ? '<div style="font-size:12px;color:'+C.muted+';margin-top:10px;">📝 '+esc(now.notes)+'</div>' : '') +
    '</div></td></tr>';
}
html += '</table>';

// Bar chart: leads by channel (top channel in sage)
const known = current.filter(r => r.leads !== null);
const maxLeads = Math.max(1, ...known.map(r => r.leads));
const best = known.reduce((a, r) => (!a || r.leads > a.leads) ? r : a, null);
html += '<div style="background:'+C.card+';border:1px solid '+C.line+';border-radius:14px;padding:16px 18px;margin:10px 5px 0;">' +
  '<div style="font-size:12px;color:'+C.muted+';margin-bottom:10px;">Leads by channel</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">';
for (const r of current) {
  const bar = r.leads === null
    ? '<span style="font-size:12px;font-weight:bold;color:'+C.clay+';">Missing</span>'
    : '<div style="background:'+(r === best ? C.sage : C.blue)+';width:'+Math.max(4, Math.round(r.leads / maxLeads * 100))+'%;height:16px;border-radius:6px;"></div>';
  html += '<tr><td width="34%" style="font-size:12px;color:'+C.ink+';padding:5px 8px 5px 0;">'+esc(r.channel)+'</td>' +
    '<td style="padding:5px 0;">'+bar+'</td>' +
    '<td width="44" align="right" style="font-size:12px;font-weight:bold;color:'+C.ink+';padding:5px 0 5px 8px;">'+(r.leads === null ? '—' : r.leads)+'</td></tr>';
}
html += '</table></div>';
if (current.length === 0) html = '<div style="padding:16px;color:'+C.clay+';font-weight:bold;">No data found for '+reportMonth+'.</div>';

return {
  report_month: reportMonth,
  previous_month: prevMonth,
  flag: flags.length > 0,
  flag_reasons: flags.length ? flags.join('\n') : 'None',
  summary_text: summary,
  cards_html: html
};
