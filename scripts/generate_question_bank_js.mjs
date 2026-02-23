#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const csvPath = process.argv[2] || path.join(repoRoot, 'assets/data/question-bank.v1.csv');
const outPath = process.argv[3] || path.join(repoRoot, 'assets/js/question-bank.js');

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
      field = '';
      rows.push(row);
      row = [];
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

function toBool(value, fallback = false){
  const raw = String(value ?? '').trim().toLowerCase();
  if(!raw) return fallback;
  if(['1','true','yes','y','on'].includes(raw)) return true;
  if(['0','false','no','n','off'].includes(raw)) return false;
  return fallback;
}

function toInt(value, fallback = 0){
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
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

const requiredCols = [
  'id','key','step','group','group_label','title','why','order',
  'required_guided','required_advanced','required_sdr_lite','enabled'
];
requiredCols.forEach((col)=> {
  if(idx[col] === undefined){
    throw new Error(`Missing required column: ${col}`);
  }
});

const rows = body
  .filter((r)=> Array.isArray(r) && r.some((cell)=> String(cell || '').trim().length))
  .map((r)=> {
    const read = (name)=> String(r[idx[name]] ?? '').trim();
    return {
      id: read('id'),
      key: read('key'),
      step: toInt(read('step'), 1),
      group: read('group'),
      groupLabel: read('group_label'),
      title: read('title'),
      why: read('why'),
      order: toInt(read('order'), 0),
      requiredGuided: toBool(read('required_guided'), true),
      requiredAdvanced: toBool(read('required_advanced'), true),
      requiredSdrLite: toBool(read('required_sdr_lite'), false),
      enabled: toBool(read('enabled'), true)
    };
  })
  .filter((row)=> row.id && row.key)
  .sort((a, b)=> {
    const byOrder = a.order - b.order;
    if(byOrder) return byOrder;
    const byStep = a.step - b.step;
    if(byStep) return byStep;
    return a.id.localeCompare(b.id);
  });

const sourceRel = path.relative(repoRoot, csvPath).replace(/\\/g, '/');
const generatedAt = new Date().toISOString();
const js = `/* Auto-generated from ${sourceRel} on ${generatedAt}. */\n` +
`/* eslint-disable */\n` +
`(function(){\n` +
`  const rows = ${JSON.stringify(rows, null, 2)};\n` +
`  const byId = Object.create(null);\n` +
`  rows.forEach((row)=> { if(row && row.id) byId[row.id] = row; });\n` +
`  window.immersiveQuestionBank = Object.freeze({\n` +
`    version: 'question-bank.v1',\n` +
`    rows: Object.freeze(rows.map((row)=> Object.freeze(row))),\n` +
`    byId: Object.freeze(byId)\n` +
`  });\n` +
`})();\n`;

fs.writeFileSync(outPath, js, 'utf8');
console.log(`Generated ${outPath}`);
console.log(`Rows: ${rows.length}`);
