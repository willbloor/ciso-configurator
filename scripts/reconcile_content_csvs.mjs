#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = '/Users/will.bloor/Documents/Configurator';
const MAX_AGE_DAYS = Number(process.env.MAX_AGE_DAYS || 1095);
const DEFAULT_IMAGE_URL = 'https://cdn.prod.website-files.com/6735fba9a631272fb4513263/679228e2e5f16602a4b0c480_Why%20Immersive-cta-image.webp';

const DEFAULT_INPUTS = [
  '/Users/will.bloor/Desktop/CSV/678a13476d0a697e355dec29-691c8c70de6fc418c5b5260a-2026-02-21T07-29-44-892Z.csv',
  '/Users/will.bloor/Desktop/CSV/Immersive - Blog Posts - 679e309747ababc3401407fa.csv',
  '/Users/will.bloor/Desktop/CSV/Immersive - C7 Blogs - 6911bd569ce807ce6a2b9b4c.csv',
  '/Users/will.bloor/Desktop/CSV/Immersive - Case Studies - 679a1722fc2dcf61d0872f01.csv',
  '/Users/will.bloor/Desktop/CSV/Immersive - Ebooks - 67a1e0fc2122bab24a53d0e2.csv',
  '/Users/will.bloor/Desktop/CSV/Immersive - Media Coverages - 679e3daa3a655710d9bc1b4c.csv',
  '/Users/will.bloor/Desktop/CSV/Immersive - Webinars - 679f9c1ff10020ae69399e53.csv'
];

const DEFAULT_MASTER_CSV = path.join(REPO_ROOT, 'assets/data/immersive-content-master.csv');
const DEFAULT_CATALOG_JS = path.join(REPO_ROOT, 'assets/js/content-catalog.js');

function usage() {
  console.log('Usage: node scripts/reconcile_content_csvs.mjs [--out-csv <path>] [--out-js <path>] [--inputs <csv1> <csv2> ...]');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let outCsv = DEFAULT_MASTER_CSV;
  let outJs = DEFAULT_CATALOG_JS;
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
    if (arg === '--out-js') {
      outJs = args[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--inputs') {
      inputs = args.slice(i + 1).filter(Boolean);
      break;
    }
  }
  if (!inputs.length) inputs = DEFAULT_INPUTS.slice();
  return { outCsv, outJs, inputs };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
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

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugify(value) {
  const token = normalizeToken(value).replace(/\s+/g, '-');
  return token.slice(0, 120);
}

function splitList(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];
  return raw
    .split(/[|,;\n]/)
    .map((part) => cleanMetadata(part))
    .filter(Boolean);
}

function cleanMetadata(raw) {
  return String(raw || '')
    .replace(/\s*:[^:]{2,80}:\s*![^!]{2,120}!/gi, ' ')
    .replace(/![^!\s]{1,80}!/g, ' ')
    .replace(/^[\s:;\-|]+/, '')
    .replace(/[\s:;\-|]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(raw) {
  const text = String(raw || '');
  if (!text) return '';
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHttpUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://www.immersivelabs.com${value}`;
  return '';
}

function parsePublished(value) {
  const raw = String(value || '').trim();
  if (!raw) return { publishedOn: '', ts: 0, ageDays: null, freshnessBucket: '' };
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return { publishedOn: raw, ts: 0, ageDays: null, freshnessBucket: '' };
  const now = Date.now();
  const diffDays = Math.max(0, Math.floor((now - ts) / 86400000));
  let freshnessBucket = '';
  if (diffDays <= 365) freshnessBucket = '<1y';
  else if (diffDays <= 730) freshnessBucket = '1-2y';
  else freshnessBucket = '2-3y';
  return {
    publishedOn: new Date(ts).toISOString(),
    ts,
    ageDays: diffDays,
    freshnessBucket
  };
}

function formatFromFile(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base.includes('c7 blog')) return 'c7-blog';
  if (base.includes('blog post')) return 'blog-post';
  if (base.includes('case stud')) return 'case-study';
  if (base.includes('ebook')) return 'ebook';
  if (base.includes('media cover')) return 'media-coverage';
  if (base.includes('webinar')) return 'webinar';
  if (base.includes('691c8c70de6fc418c5b5260a')) return 'c7-blog';
  return 'content';
}

function normalizeFormat(raw, fallback) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'blog-post' || value === 'blogpost' || value === 'blog') return 'blog-post';
  if (value === 'c7-blog' || value === 'c7blog') return 'c7-blog';
  if (value === 'case-study' || value === 'casestudy' || value === 'case-study-link') return 'case-study';
  if (value === 'ebook' || value === 'e-book') return 'ebook';
  if (value === 'media-coverage' || value === 'mediacoverage') return 'media-coverage';
  if (value === 'webinar' || value === 'webinars') return 'webinar';
  return value;
}

function inferredCanonicalUrl(format, slug) {
  const safeSlug = String(slug || '').trim();
  if (!safeSlug) return '';
  if (format === 'blog-post' || format === 'c7-blog' || format === 'media-coverage') {
    return `https://www.immersivelabs.com/resources/c7-blog/${encodeURIComponent(safeSlug)}/`;
  }
  if (format === 'case-study') {
    return `https://www.immersivelabs.com/resources/case-study/${encodeURIComponent(safeSlug)}/`;
  }
  if (format === 'ebook') {
    return `https://www.immersivelabs.com/resources/ebook/${encodeURIComponent(safeSlug)}/`;
  }
  if (format === 'webinar') {
    return `https://www.immersivelabs.com/resources/webinars/${encodeURIComponent(safeSlug)}/`;
  }
  return '';
}

function pickValue(row, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    const key = canonicalKey(aliases[i]);
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function toRowObjects(csvText) {
  const matrix = parseCsv(csvText);
  if (!matrix.length) return [];
  const headers = matrix[0].map((h) => canonicalKey(h));
  return matrix.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((key, idx) => {
      obj[key] = idx < cells.length ? cells[idx] : '';
    });
    return obj;
  });
}

function buildRecord(row, sourcePath) {
  const sourceCsv = path.basename(sourcePath);
  const format = normalizeFormat(
    pickValue(row, ['Format', 'format']),
    formatFromFile(sourcePath)
  );
  const title = pickValue(row, ['Name', 'Title']);
  if (!title) return null;
  const slugRaw = pickValue(row, ['Slug']);
  const slug = slugRaw || slugify(title);
  const category = cleanMetadata(pickValue(row, ['Category']));
  const topicTags = splitList(pickValue(row, ['Topic Tags', 'Page Tags', 'topicTags', 'topic_tags']));
  const contributors = splitList(pickValue(row, ['Contributors', 'Author/s', 'Speakers', 'contributors']));

  const publishedMeta = parsePublished(
    pickValue(row, ['Post Date', 'Published On', 'Updated On', 'Created On', 'publishedOn', 'published_on', 'publishedDate'])
  );

  const imageUrl = normalizeHttpUrl(
    pickValue(row, ['imageUrl', 'Image URL', 'Image'])
  );
  const thumbnailUrl = normalizeHttpUrl(
    pickValue(row, ['Thumbnail image', 'thumbnailUrl', 'thumbnail_url'])
  ) || imageUrl;
  const headerImageUrl = normalizeHttpUrl(
    pickValue(row, ['Header Image', 'headerImageUrl', 'header_image_url'])
  );
  const resolvedImageUrl = imageUrl || thumbnailUrl || headerImageUrl;

  const canonicalUrl = normalizeHttpUrl(
    pickValue(row, ['URL', 'Canonical URL', 'url', 'canonicalUrl', 'canonical_url'])
  ) || inferredCanonicalUrl(format, slug);

  const externalUrl = normalizeHttpUrl(
    pickValue(row, [
      'Media Link',
      'Case Study Link',
      'Hubspot Landing Page',
      'Hubspot Page',
      'External Media Link',
      'externalUrl',
      'external_url'
    ])
  );

  const resolvedUrl = externalUrl || canonicalUrl;
  const summary = stripHtml(
    pickValue(row, ['Stand First', 'Meta Description', 'Quote Text', 'Header Text', 'Post Body', 'summary'])
  ).slice(0, 360);
  const sourceCollectionId = pickValue(row, ['Collection ID', 'sourceCollectionId', 'source_collection_id']);
  const sourceCsvValue = pickValue(row, ['sourceCsv', 'source_csv']) || sourceCsv;

  return {
    id: `${format}:${slug}`,
    title,
    slug,
    format,
    category,
    topicTags,
    contributors,
    url: resolvedUrl,
    canonicalUrl,
    externalUrl,
    publishedOn: publishedMeta.publishedOn,
    publishedTs: publishedMeta.ts,
    ageDays: publishedMeta.ageDays,
    freshnessBucket: publishedMeta.freshnessBucket,
    imageUrl: resolvedImageUrl,
    thumbnailUrl,
    headerImageUrl,
    summary,
    sourceCsv: sourceCsvValue,
    sourceCollectionId
  };
}

function withinAgeLimit(row) {
  if (row.ageDays == null) return true;
  return row.ageDays <= MAX_AGE_DAYS;
}

function recencyScore(row) {
  if (row.ageDays == null) return 20;
  if (row.ageDays <= 365) return 90;
  if (row.ageDays <= 730) return 50;
  if (row.ageDays <= MAX_AGE_DAYS) return 20;
  return -400;
}

function rowQualityScore(row) {
  let score = 0;
  score += recencyScore(row);
  if (row.imageUrl) score += 180;
  if (row.url) score += 140;
  if (row.summary) score += 30;
  if ((row.topicTags || []).length) score += 15;
  if ((row.contributors || []).length) score += 10;
  if (row.publishedTs) score += row.publishedTs / 1e12;
  return score;
}

function buildImageLookup(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!row || !row.imageUrl) return;
    const slugKey = slugify(row.slug || '');
    const titleKey = normalizeToken(row.title || '');
    const urlSlug = (() => {
      const url = String(row.url || '').trim();
      if (!url) return '';
      try {
        const parsed = new URL(url);
        const bits = String(parsed.pathname || '').split('/').filter(Boolean);
        return bits.length ? slugify(bits[bits.length - 1]) : '';
      } catch (err) {
        return '';
      }
    })();
    if (slugKey && !map.has(`slug:${slugKey}`)) map.set(`slug:${slugKey}`, row.imageUrl);
    if (titleKey && !map.has(`title:${titleKey}`)) map.set(`title:${titleKey}`, row.imageUrl);
    if (urlSlug && !map.has(`url:${urlSlug}`)) map.set(`url:${urlSlug}`, row.imageUrl);
  });
  return map;
}

function reconcileImage(row, map) {
  if (row.imageUrl) return row.imageUrl;
  const keys = [];
  const slugKey = slugify(row.slug || '');
  const titleKey = normalizeToken(row.title || '');
  if (slugKey) keys.push(`slug:${slugKey}`);
  if (titleKey) keys.push(`title:${titleKey}`);
  const url = String(row.url || '').trim();
  if (url) {
    try {
      const parsed = new URL(url);
      const bits = String(parsed.pathname || '').split('/').filter(Boolean);
      const tail = bits.length ? slugify(bits[bits.length - 1]) : '';
      if (tail) keys.push(`url:${tail}`);
    } catch (err) {
      // ignore
    }
  }
  for (let i = 0; i < keys.length; i += 1) {
    const hit = map.get(keys[i]);
    if (hit) return hit;
  }
  return '';
}

function dedupeRows(rows) {
  const byKey = new Map();
  rows.forEach((row) => {
    if (!row) return;
    const key = `${row.format}|${slugify(row.slug || row.title || row.id)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      return;
    }
    if (rowQualityScore(row) > rowQualityScore(prev)) {
      byKey.set(key, row);
    }
  });
  return Array.from(byKey.values());
}

function writeMasterCsv(rows, outPath) {
  const columns = [
    'id',
    'title',
    'slug',
    'format',
    'category',
    'topicTags',
    'contributors',
    'url',
    'canonicalUrl',
    'externalUrl',
    'publishedOn',
    'publishedTs',
    'ageDays',
    'freshnessBucket',
    'imageUrl',
    'thumbnailUrl',
    'headerImageUrl',
    'summary',
    'sourceCsv',
    'sourceCollectionId'
  ];
  const lines = [columns.join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((col) => {
      const value = row[col];
      if (Array.isArray(value)) return csvEscape(value.join('|'));
      return csvEscape(value == null ? '' : value);
    }).join(','));
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
}

function writeCatalogJs(rows, outPath) {
  const payload = rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    format: row.format,
    category: row.category,
    topicTags: Array.isArray(row.topicTags) ? row.topicTags : [],
    contributors: Array.isArray(row.contributors) ? row.contributors : [],
    url: row.url,
    publishedOn: row.publishedOn,
    sourceCsv: row.sourceCsv,
    imageUrl: row.imageUrl,
    summary: row.summary,
    freshnessBucket: row.freshnessBucket
  }));
  const js = `// Generated from reconciled Webflow CSV exports (<= ${MAX_AGE_DAYS} days)\nwindow.immersiveContentCatalog = ${JSON.stringify(payload)};\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, js, 'utf8');
}

function main() {
  const { outCsv, outJs, inputs } = parseArgs(process.argv);
  const missing = inputs.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    throw new Error(`Missing input files:\n${missing.map((m) => `- ${m}`).join('\n')}`);
  }

  const rawRows = [];
  inputs.forEach((inputPath) => {
    const text = fs.readFileSync(inputPath, 'utf8');
    const objects = toRowObjects(text);
    objects.forEach((obj) => {
      const row = buildRecord(obj, inputPath);
      if (row) rawRows.push(row);
    });
  });

  const withinLimit = rawRows.filter(withinAgeLimit);
  const deduped = dedupeRows(withinLimit);
  const imageLookup = buildImageLookup(deduped);
  const reconciled = deduped.map((row) => ({
    ...row,
    imageUrl: row.imageUrl || reconcileImage(row, imageLookup) || DEFAULT_IMAGE_URL
  }));

  reconciled.sort((a, b) => {
    const recencyDelta = recencyScore(b) - recencyScore(a);
    if (recencyDelta) return recencyDelta;
    const tsDelta = (b.publishedTs || 0) - (a.publishedTs || 0);
    if (tsDelta) return tsDelta;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  writeMasterCsv(reconciled, outCsv);
  writeCatalogJs(reconciled, outJs);

  const withImages = reconciled.filter((row) => !!row.imageUrl).length;
  const withUrls = reconciled.filter((row) => !!row.url).length;
  const freshness = {
    fresh: reconciled.filter((row) => row.freshnessBucket === '<1y').length,
    recent: reconciled.filter((row) => row.freshnessBucket === '1-2y').length,
    older: reconciled.filter((row) => row.freshnessBucket === '2-3y').length
  };

  console.log(`Inputs: ${inputs.length}`);
  console.log(`Rows parsed: ${rawRows.length}`);
  console.log(`Rows kept (<= ${MAX_AGE_DAYS} days, deduped): ${reconciled.length}`);
  console.log(`Rows with imageUrl: ${withImages}`);
  console.log(`Rows with url: ${withUrls}`);
  console.log(`Freshness buckets: <1y=${freshness.fresh}, 1-2y=${freshness.recent}, 2-3y=${freshness.older}`);
  console.log(`Wrote master CSV: ${outCsv}`);
  console.log(`Wrote catalog JS: ${outJs}`);
}

main();
