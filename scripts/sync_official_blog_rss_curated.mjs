#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = '/Users/will.bloor/Documents/Configurator';
const inputPath = process.argv[2] || '';
const csvOutPath = process.argv[3] || path.join(repoRoot, 'assets/data/official-blog-rss-curated.csv');
const jsOutPath = process.argv[4] || path.join(repoRoot, 'assets/js/official-blog-rss-fallback.js');

const MAX_AGE_DAYS = Number(process.env.MAX_AGE_DAYS || 1095);

function readInput(){
  if(inputPath){
    return fs.readFileSync(inputPath, 'utf8');
  }
  return fs.readFileSync(0, 'utf8');
}

function stripCdata(raw){
  const text = String(raw || '').trim();
  if(!text) return '';
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/i);
  return cdata ? cdata[1] : text;
}

function decodeHtml(raw){
  return String(raw || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

function cleanText(raw){
  return decodeHtml(stripCdata(raw))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s*:[^:]{2,80}:\s*![^!]{2,120}!/gi, ' ')
    .replace(/![^!\s]{1,80}!/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tagValue(block, tagName){
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = block.match(re);
  if(!m) return '';
  return cleanText(m[1]);
}

function mediaUrl(block){
  const m = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl=["']([^"']+)["']/i);
  return m && m[1] ? decodeHtml(m[1].trim()) : '';
}

function toSlug(url){
  try{
    const u = new URL(url);
    const bits = String(u.pathname || '').split('/').filter(Boolean);
    return bits.length ? bits[bits.length - 1] : '';
  }catch(err){
    return '';
  }
}

function ageDays(ts){
  if(!Number.isFinite(ts)) return null;
  const diff = Date.now() - ts;
  if(!Number.isFinite(diff)) return null;
  if(diff < 0) return 0;
  return Math.floor(diff / 86400000);
}

function csvEscape(v){
  const s = String(v == null ? '' : v);
  if(/[",\n]/.test(s)){
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseItems(xml){
  const items = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/gi;
  const seen = new Set();
  let match = null;
  while((match = itemRe.exec(xml))){
    const block = match[0];
    const title = tagValue(block, 'title');
    const link = tagValue(block, 'link');
    const pubDateRaw = tagValue(block, 'pubDate');
    if(!title || !link) continue;
    const publishedTs = Date.parse(pubDateRaw);
    const itemAgeDays = ageDays(publishedTs);
    if(itemAgeDays != null && itemAgeDays > MAX_AGE_DAYS) continue;

    const summary = tagValue(block, 'description');
    const imageUrl = mediaUrl(block);
    const slug = toSlug(link);
    const key = `${link}|${title.toLowerCase()}`;
    if(seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: `blog-post:rss:${slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
      title,
      slug,
      format: 'blog-post',
      category: 'blog',
      url: link,
      publishedOn: Number.isFinite(publishedTs) ? new Date(publishedTs).toISOString() : '',
      imageUrl,
      summary,
      sourceCsv: 'RSS: Blog (official)'
    });
  }
  items.sort((a, b)=> Date.parse(b.publishedOn || 0) - Date.parse(a.publishedOn || 0));
  return items;
}

function writeCsv(rows){
  const header = [
    'id',
    'title',
    'slug',
    'format',
    'category',
    'url',
    'publishedOn',
    'imageUrl',
    'summary',
    'sourceCsv'
  ];
  const lines = [header.join(',')];
  rows.forEach((row)=>{
    lines.push(header.map((key)=> csvEscape(row[key])).join(','));
  });
  fs.writeFileSync(csvOutPath, `${lines.join('\n')}\n`, 'utf8');
}

function writeJs(rows){
  const payload = JSON.stringify(rows);
  const body = `// Generated from official Immersive blog RSS (<= ${MAX_AGE_DAYS} days)\nwindow.immersiveOfficialBlogRssFallback = ${payload};\n`;
  fs.writeFileSync(jsOutPath, body, 'utf8');
}

const xmlText = readInput();
if(!xmlText || !String(xmlText).trim()){
  throw new Error('No RSS XML input found.');
}
const rows = parseItems(String(xmlText));
writeCsv(rows);
writeJs(rows);

console.log(`Wrote ${rows.length} rows:`);
console.log(`- ${csvOutPath}`);
console.log(`- ${jsOutPath}`);
