#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const csvPath = process.argv[2] || path.join(repoRoot, 'assets/data/capability-language-rules.v1.csv');
const outPath = process.argv[3] || path.join(repoRoot, 'assets/js/capability-language-rules.js');

function parseCsv(text){
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while(i < text.length){
    const ch = text[i];
    if(inQuotes){
      if(ch === '"'){
        if(text[i + 1] === '"'){
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
    if(ch === '"'){
      inQuotes = true;
      i += 1;
      continue;
    }
    if(ch === ','){
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if(ch === '\n'){
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    if(ch === '\r'){
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if(field.length || row.length){
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toInt(value, fallback = 0){
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value, fallback = false){
  const raw = String(value ?? '').trim().toLowerCase();
  if(!raw) return fallback;
  if(['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
  if(['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
  return fallback;
}

const csvText = fs.readFileSync(csvPath, 'utf8');
const matrix = parseCsv(csvText);
if(!matrix.length){
  throw new Error(`No rows in ${csvPath}`);
}

const [header, ...body] = matrix;
const cols = header.map((h)=> String(h || '').trim());
const idx = Object.create(null);
cols.forEach((col, i)=> { idx[col] = i; });

[
  'rule_id',
  'capability_id',
  'outcome_id',
  'signal_token',
  'priority',
  'bullet_template',
  'enabled'
].forEach((col)=>{
  if(idx[col] === undefined){
    throw new Error(`Missing required column: ${col}`);
  }
});

const rows = body
  .filter((r)=> Array.isArray(r) && r.some((cell)=> String(cell || '').trim()))
  .map((r, rowIdx)=>{
    const read = (name)=> String(r[idx[name]] ?? '').trim();
    return {
      ruleId: read('rule_id'),
      capabilityId: read('capability_id') || '*',
      outcomeId: read('outcome_id') || '*',
      signalToken: read('signal_token') || '*',
      priority: toInt(read('priority'), 0),
      bulletTemplate: read('bullet_template'),
      enabled: toBool(read('enabled'), true),
      order: rowIdx
    };
  })
  .filter((row)=> row.ruleId && row.bulletTemplate)
  .sort((a, b)=> {
    const byPriority = b.priority - a.priority;
    if(byPriority) return byPriority;
    return a.order - b.order;
  });

const sourceRel = path.relative(repoRoot, csvPath).replace(/\\/g, '/');
const generatedAt = new Date().toISOString();
const js = `/* Auto-generated from ${sourceRel} on ${generatedAt}. */\n` +
`/* eslint-disable */\n` +
`(function(){\n` +
`  const rows = ${JSON.stringify(rows, null, 2)};\n` +
`  window.immersiveCapabilityLanguageRules = Object.freeze({\n` +
`    version: 'capability-language-rules.v1',\n` +
`    rows: Object.freeze(rows.map((row)=> Object.freeze(row)))\n` +
`  });\n` +
`})();\n`;

fs.writeFileSync(outPath, js, 'utf8');
console.log(`Generated ${outPath}`);
console.log(`Rows: ${rows.length}`);
