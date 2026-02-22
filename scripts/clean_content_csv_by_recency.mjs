#!/usr/bin/env node
import fs from 'node:fs';

const inPath = process.argv[2];
const outPath = process.argv[3];
const maxAgeDays = Number(process.env.MAX_AGE_DAYS || 1095);

if(!inPath || !outPath){
  console.error('Usage: node scripts/clean_content_csv_by_recency.mjs <input.csv> <output.csv>');
  process.exit(1);
}

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

function escapeCsv(value){
  const text = String(value == null ? '' : value);
  if(/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const raw = fs.readFileSync(inPath, 'utf8');
const rows = parseCsv(raw).filter((r)=> r.length && r.some((cell)=> String(cell || '').trim()));
if(!rows.length){
  throw new Error('Input CSV is empty');
}

const header = rows[0].map((h)=> String(h || '').trim());
const publishedIdx = header.findIndex((h)=> /^published(on|_on|date)$/i.test(h) || /^date$/i.test(h));
if(publishedIdx < 0){
  throw new Error('Could not find a published date column (expected publishedOn/published_on/publishedDate/date).');
}

const bucketCol = 'freshnessBucket';
const outHeader = header.includes(bucketCol) ? header : header.concat(bucketCol);
const now = Date.now();

const cleaned = rows.slice(1)
  .map((row)=>{
    const entry = outHeader.map((col, idx)=>{
      if(idx < header.length) return row[idx] || '';
      return '';
    });
    const publishedRaw = String(row[publishedIdx] || '').trim();
    const ts = Date.parse(publishedRaw);
    if(!Number.isFinite(ts)) return null;
    const ageDays = Math.max(0, Math.floor((now - ts) / 86400000));
    if(ageDays > maxAgeDays) return null;
    const bucket = ageDays <= 365 ? '<1y' : (ageDays <= 730 ? '1-2y' : '2-3y');
    const bucketIdx = outHeader.indexOf(bucketCol);
    if(bucketIdx >= 0) entry[bucketIdx] = bucket;
    return { entry, ts };
  })
  .filter(Boolean)
  .sort((a, b)=> b.ts - a.ts)
  .map((row)=> row.entry);

const lines = [outHeader.join(',')].concat(cleaned.map((row)=> row.map(escapeCsv).join(',')));
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${cleaned.length} rows to ${outPath}`);
