#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = '/Users/will.bloor/Documents/Configurator';
const MAX_AGE_DAYS = Number(process.env.OPS_MAX_AGE_DAYS || 3650);

const DEFAULT_INPUTS = [
  '/Users/will.bloor/Desktop/CSV/immersive-records-high-fidelity-2026-02-21.csv'
];
const DEFAULT_OUT_CSV = path.join(REPO_ROOT, 'assets/data/operations-records-master.csv');

function usage() {
  console.log('Usage: node scripts/reconcile_operations_csvs.mjs [--out-csv <path>] [--inputs <csv1> <csv2> ...]');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let outCsv = DEFAULT_OUT_CSV;
  let inputs = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--out-csv') {
      outCsv = args[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--inputs') {
      inputs = args.slice(i + 1).filter(Boolean);
      break;
    }
  }
  if (!inputs.length) inputs = DEFAULT_INPUTS.slice();
  return { outCsv, inputs };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell || '').trim()));
}

function csvEscape(value) {
  const text = String(value == null ? '' : value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function canonicalKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function token(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  return token(value).replace(/\s+/g, '-').slice(0, 80);
}

function parseRowObjects(csvText) {
  const matrix = parseCsv(csvText);
  if (!matrix.length) return [];
  const headers = matrix[0].map((h) => canonicalKey(h));
  return matrix.slice(1).map((cells, idx) => {
    const row = { __rowNo: idx + 2 };
    headers.forEach((key, i) => {
      row[key] = i < cells.length ? cells[i] : '';
    });
    return row;
  });
}

function pickValue(row, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    const key = canonicalKey(aliases[i]);
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function parseNumber(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const cleaned = value.replace(/[^0-9.-]/g, '');
  if (!cleaned) return '';
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : '';
}

function parseBoolean(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return false;
  return value === 'true' || value === '1' || value === 'yes' || value === 'y';
}

function isoDate(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toISOString();
}

function timestamp(raw) {
  const value = String(raw || '').trim();
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function completionPct(completionRaw, pctRaw) {
  const explicit = parseNumber(pctRaw);
  if (explicit !== '') return Math.max(0, Math.min(100, Number(explicit)));
  const completion = String(completionRaw || '').trim();
  if (!completion) return '';
  const pctMatch = completion.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    const pct = Number(pctMatch[1]);
    if (Number.isFinite(pct)) return Math.max(0, Math.min(100, pct));
  }
  const ratioMatch = completion.match(/(\d+)\s*\/\s*(\d+)/);
  if (ratioMatch) {
    const done = Number(ratioMatch[1]);
    const total = Number(ratioMatch[2]);
    if (Number.isFinite(done) && Number.isFinite(total) && total > 0) {
      return Math.round((done / total) * 100);
    }
  }
  return '';
}

function splitList(raw) {
  const value = String(raw || '').trim();
  if (!value) return [];
  return value
    .split(/[;|]/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeDateAgeDays(isoText) {
  const ts = timestamp(isoText);
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff)) return null;
  if (diff < 0) return 0;
  return Math.floor(diff / 86400000);
}

function withinAgeLimit(row) {
  const ageDays = normalizeDateAgeDays(row.updated_at || row.created_at);
  if (ageDays == null) return true;
  return ageDays <= MAX_AGE_DAYS;
}

function makeRecord(row, sourceCsv) {
  const company = pickValue(row, ['company', 'company_name']);
  const fullName = pickValue(row, ['full_name', 'name']);
  const idRaw = pickValue(row, ['record_id', 'id']);
  const recordId = idRaw || slugify(`${company || 'record'}-${fullName || row.__rowNo}`);
  const completion = pickValue(row, ['completion']);
  const completionPctValue = completionPct(completion, pickValue(row, ['completion_pct', 'completion_percent']));
  const outcomesList = splitList(pickValue(row, ['outcomes', 'outcomes_text']));
  const updatedAt = isoDate(pickValue(row, ['updated_at', 'date_modified', 'modified']));
  const createdAt = isoDate(pickValue(row, ['created_at', 'date_created', 'created']));

  return {
    record_id: recordId,
    company,
    stage: pickValue(row, ['stage']) || 'Discovery',
    completion: completion || (completionPctValue !== '' ? `${completionPctValue}%` : ''),
    completion_pct: completionPctValue,
    tier: pickValue(row, ['tier', 'recommended_tier']) || 'Core',
    open_gaps: parseNumber(pickValue(row, ['open_gaps'])),
    gap_summary: pickValue(row, ['gap_summary', 'remaining_gaps', 'gaps']),
    priority: parseBoolean(pickValue(row, ['priority', 'starred'])),
    archived: parseBoolean(pickValue(row, ['archived'])),
    outcomes: outcomesList.join('; '),
    created_at: createdAt,
    updated_at: updatedAt,
    full_name: fullName,
    role: pickValue(row, ['role']),
    company_size: pickValue(row, ['company_size']),
    operating_country: pickValue(row, ['operating_country', 'country']),
    industry: pickValue(row, ['industry']),
    region: pickValue(row, ['region']),
    pressure_sources: pickValue(row, ['pressure_sources']),
    urgent_win: pickValue(row, ['urgent_win']),
    risk_environments: pickValue(row, ['risk_environments']),
    measured_on_today: pickValue(row, ['measured_on_today', 'measured_on']),
    organisation_pain: pickValue(row, ['organisation_pain', 'org_pain']),
    drivers: pickValue(row, ['drivers']),
    evidence_audience: pickValue(row, ['evidence_audience']),
    coverage_groups: pickValue(row, ['coverage_groups']),
    cadence: pickValue(row, ['cadence', 'rhythm']),
    measurement: pickValue(row, ['measurement', 'measure']),
    fit_realism: pickValue(row, ['fit_realism']),
    fit_scope: pickValue(row, ['fit_scope']),
    fit_today: pickValue(row, ['fit_today']),
    fit_services: pickValue(row, ['fit_services']),
    fit_risk_frame: pickValue(row, ['fit_risk_frame']),
    regulations: pickValue(row, ['regulations', 'regs']),
    stack: pickValue(row, ['stack']),
    currency: pickValue(row, ['currency']) || 'USD',
    revenue_b_usd: parseNumber(pickValue(row, ['revenue_b_usd'])),
    spend_usd_annual: parseNumber(pickValue(row, ['spend_usd_annual', 'indicative_spend'])),
    team_cyber: parseNumber(pickValue(row, ['team_cyber'])),
    team_dev: parseNumber(pickValue(row, ['team_dev'])),
    team_workforce: parseNumber(pickValue(row, ['team_workforce'])),
    roi_pct_3yr: parseNumber(pickValue(row, ['roi_pct_3yr', 'roi_3yr_pct'])),
    npv_usd_3yr: parseNumber(pickValue(row, ['npv_usd_3yr', 'npv_3yr'])),
    payback_months: parseNumber(pickValue(row, ['payback_months'])),
    outcomes_json: pickValue(row, ['outcomes_json']),
    gaps_json: pickValue(row, ['gaps_json']),
    modules_json: pickValue(row, ['modules_json']),
    snapshot_json: pickValue(row, ['snapshot_json']),
    viz_json: pickValue(row, ['viz_json']),
    record_json: pickValue(row, ['record_json']),
    source_csv: sourceCsv,
    source_row_number: row.__rowNo
  };
}

function recordTimestamp(row) {
  const updated = timestamp(row.updated_at);
  if (updated) return updated;
  return timestamp(row.created_at);
}

function dedupeRows(rows) {
  const selected = new Map();
  rows.forEach((row) => {
    const key = row.record_id || slugify(row.company || `row-${row.source_row_number}`);
    const prev = selected.get(key);
    if (!prev) {
      selected.set(key, row);
      return;
    }
    const prevTs = recordTimestamp(prev);
    const nextTs = recordTimestamp(row);
    if (nextTs > prevTs) {
      selected.set(key, row);
      return;
    }
    if (nextTs === prevTs) {
      const prevPct = Number(prev.completion_pct || -1);
      const nextPct = Number(row.completion_pct || -1);
      if (nextPct > prevPct) selected.set(key, row);
    }
  });
  return Array.from(selected.values());
}

function writeCsv(rows, outPath) {
  const columns = [
    'record_id',
    'company',
    'stage',
    'completion',
    'completion_pct',
    'tier',
    'open_gaps',
    'gap_summary',
    'priority',
    'archived',
    'outcomes',
    'created_at',
    'updated_at',
    'full_name',
    'role',
    'company_size',
    'operating_country',
    'industry',
    'region',
    'pressure_sources',
    'urgent_win',
    'risk_environments',
    'measured_on_today',
    'organisation_pain',
    'drivers',
    'evidence_audience',
    'coverage_groups',
    'cadence',
    'measurement',
    'fit_realism',
    'fit_scope',
    'fit_today',
    'fit_services',
    'fit_risk_frame',
    'regulations',
    'stack',
    'currency',
    'revenue_b_usd',
    'spend_usd_annual',
    'team_cyber',
    'team_dev',
    'team_workforce',
    'roi_pct_3yr',
    'npv_usd_3yr',
    'payback_months',
    'outcomes_json',
    'gaps_json',
    'modules_json',
    'snapshot_json',
    'viz_json',
    'record_json',
    'source_csv',
    'source_row_number'
  ];
  const lines = [columns.join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((col) => csvEscape(row[col])).join(','));
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const { outCsv, inputs } = parseArgs(process.argv);
  const missing = inputs.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    throw new Error(`Missing input files:\n${missing.map((m) => `- ${m}`).join('\n')}`);
  }

  const parsedRows = [];
  inputs.forEach((inputPath) => {
    const text = fs.readFileSync(inputPath, 'utf8');
    const sourceCsv = path.basename(inputPath);
    const rows = parseRowObjects(text);
    rows.forEach((row) => parsedRows.push(makeRecord(row, sourceCsv)));
  });

  const recentRows = parsedRows.filter(withinAgeLimit);
  const deduped = dedupeRows(recentRows)
    .sort((a, b) => {
      const tsDelta = recordTimestamp(b) - recordTimestamp(a);
      if (tsDelta) return tsDelta;
      return String(a.company || '').localeCompare(String(b.company || ''));
    });

  writeCsv(deduped, outCsv);

  const archivedCount = deduped.filter((row) => !!row.archived).length;
  const priorityCount = deduped.filter((row) => !!row.priority).length;
  console.log(`Inputs: ${inputs.length}`);
  console.log(`Rows parsed: ${parsedRows.length}`);
  console.log(`Rows kept (<= ${MAX_AGE_DAYS} days, deduped): ${deduped.length}`);
  console.log(`Priority rows: ${priorityCount}`);
  console.log(`Archived rows: ${archivedCount}`);
  console.log(`Wrote operations master CSV: ${outCsv}`);
}

main();
