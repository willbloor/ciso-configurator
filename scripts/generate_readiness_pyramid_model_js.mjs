#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const csvPath = process.argv[2] || path.join(repoRoot, 'assets/data/readiness-pyramid-model.v1.csv');
const outPath = process.argv[3] || path.join(repoRoot, 'assets/js/readiness-pyramid-model.js');

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

function toBool(value, fallback = true){
  const raw = String(value ?? '').trim().toLowerCase();
  if(!raw) return fallback;
  if(['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true;
  if(['0', 'false', 'no', 'n', 'off'].includes(raw)) return false;
  return fallback;
}

function toInt(value, fallback = 0){
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function splitList(value){
  return String(value ?? '')
    .split('|')
    .map((part)=> part.trim())
    .filter(Boolean);
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
  'row_id',
  'row_type',
  'layer_order',
  'title',
  'description',
  'question_keys',
  'option_ids',
  'pain_ids',
  'outcome_ids',
  'capability_ids',
  'pibr_track',
  'content_tags',
  'enabled'
].forEach((col)=>{
  if(idx[col] === undefined){
    throw new Error(`Missing required column: ${col}`);
  }
});

const bodyRows = body
  .filter((r)=> Array.isArray(r) && r.some((cell)=> String(cell || '').trim()))
  .map((r, rowIdx)=>{
    if(r.length !== cols.length){
      throw new Error(
        `Malformed CSV row ${rowIdx + 2}: expected ${cols.length} columns, got ${r.length}. ` +
        'Check comma escaping/quoting in the source CSV.'
      );
    }
    return r;
  });

const rows = bodyRows
  .map((r, rowIdx)=>{
    const read = (name)=> String(r[idx[name]] ?? '').trim();
    return {
      id: read('row_id'),
      type: read('row_type'),
      layerOrder: toInt(read('layer_order'), 0),
      title: read('title'),
      description: read('description'),
      questionKeys: splitList(read('question_keys')),
      optionIds: splitList(read('option_ids')),
      painIds: splitList(read('pain_ids')),
      outcomeIds: splitList(read('outcome_ids')),
      capabilityIds: splitList(read('capability_ids')),
      pibrTrack: read('pibr_track'),
      contentTags: splitList(read('content_tags')),
      enabled: toBool(read('enabled'), true),
      order: rowIdx
    };
  })
  .filter((row)=> row.id && row.type && row.title)
  .sort((a, b)=>{
    const byLayer = a.layerOrder - b.layerOrder;
    if(byLayer) return byLayer;
    return a.order - b.order;
  });

const byType = rows.reduce((acc, row)=>{
  const key = String(row.type || '').trim() || 'unknown';
  if(!acc[key]) acc[key] = [];
  acc[key].push(row);
  return acc;
}, Object.create(null));

const sourceRel = path.relative(repoRoot, csvPath).replace(/\\/g, '/');
const generatedAt = new Date().toISOString();
const js = `/* Auto-generated from ${sourceRel} on ${generatedAt}. */\n` +
`/* eslint-disable */\n` +
`(function(){\n` +
`  const rows = ${JSON.stringify(rows, null, 2)};\n` +
`  const byType = ${JSON.stringify(byType, null, 2)};\n` +
`  window.immersiveReadinessPyramidModel = Object.freeze({\n` +
`    version: 'readiness-pyramid-model.v1',\n` +
`    rows: Object.freeze(rows.map((row)=> Object.freeze(row))),\n` +
`    byType: Object.freeze(Object.keys(byType).reduce((acc, key)=> {\n` +
`      acc[key] = Object.freeze((byType[key] || []).map((row)=> Object.freeze(row)));\n` +
`      return acc;\n` +
`    }, Object.create(null)))\n` +
`  });\n` +
`})();\n`;

fs.writeFileSync(outPath, js, 'utf8');
console.log(`Generated ${outPath}`);
console.log(`Rows: ${rows.length}`);
