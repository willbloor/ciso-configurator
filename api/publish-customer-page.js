const { put } = require('@vercel/blob');

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_COMPANY_CHARS = 120;
const HOST_PATTERN = /^[a-z0-9.-]+(?::\d{1,5})?$/i;

function firstHeaderValue(value){
  return String(value || '').split(',')[0].trim();
}

function normalizedHost(value){
  const host = firstHeaderValue(value).toLowerCase();
  if(!host || !HOST_PATTERN.test(host)) return '';
  return host;
}

function requestHost(req){
  return normalizedHost(
    (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || ''
  );
}

function sameOriginRequest(req){
  const originRaw = firstHeaderValue(req && req.headers && req.headers.origin);
  if(!originRaw) return true;
  const expectedHost = requestHost(req);
  if(!expectedHost) return false;
  try{
    const originUrl = new URL(originRaw);
    return String(originUrl.host || '').toLowerCase() === expectedHost;
  }catch(err){
    return false;
  }
}

function toSlug(value){
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'customer-page';
}

function parseBody(req){
  if(req && req.body && typeof req.body === 'object' && !Array.isArray(req.body)){
    return req.body;
  }
  if(req && typeof req.body === 'string'){
    try{
      return JSON.parse(req.body);
    }catch(err){
      return null;
    }
  }
  return null;
}

function sendJson(res, statusCode, payload){
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res){
  if(req.method !== 'POST'){
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, {
      ok: false,
      error: 'method_not_allowed'
    });
  }

  const contentType = String(req && req.headers && req.headers['content-type'] || '').toLowerCase();
  if(!contentType.includes('application/json')){
    return sendJson(res, 415, {
      ok: false,
      error: 'unsupported_media_type',
      message: 'Use Content-Type: application/json.'
    });
  }

  if(!sameOriginRequest(req)){
    return sendJson(res, 403, {
      ok: false,
      error: 'forbidden_origin'
    });
  }

  if(!process.env.BLOB_READ_WRITE_TOKEN){
    return sendJson(res, 500, {
      ok: false,
      error: 'blob_token_missing',
      message: 'Set BLOB_READ_WRITE_TOKEN in Vercel project environment variables.'
    });
  }

  const body = parseBody(req);
  if(!body){
    return sendJson(res, 400, {
      ok: false,
      error: 'invalid_json_body'
    });
  }

  const company = String(body.company || '').trim().slice(0, MAX_COMPANY_CHARS);
  const slug = toSlug(body.slug || company || 'customer-page');
  const html = String(body.html || '');
  if(!html){
    return sendJson(res, 400, {
      ok: false,
      error: 'html_required'
    });
  }

  const htmlBytes = Buffer.byteLength(html, 'utf8');
  if(htmlBytes > MAX_HTML_BYTES){
    return sendJson(res, 413, {
      ok: false,
      error: 'html_too_large',
      maxBytes: MAX_HTML_BYTES
    });
  }

  const pathname = `customer-pages/${slug}.html`;
  try{
    const uploaded = await put(pathname, html, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'text/html; charset=utf-8'
    });
    const protoRaw = firstHeaderValue(req && req.headers && req.headers['x-forwarded-proto']).toLowerCase();
    const proto = (protoRaw === 'http' || protoRaw === 'https') ? protoRaw : 'https';
    const host = requestHost(req);
    const livePath = `/customer-pages/${slug}`;
    const liveUrl = host ? `${proto}://${host}${livePath}` : '';
    return sendJson(res, 200, {
      ok: true,
      slug,
      company,
      url: uploaded.url,
      livePath,
      liveUrl,
      pathname: uploaded.pathname || pathname,
      contentType: uploaded.contentType || 'text/html; charset=utf-8',
      size: uploaded.size || htmlBytes,
      uploadedAt: uploaded.uploadedAt || new Date().toISOString(),
      publishedAt: new Date().toISOString()
    });
  }catch(err){
    return sendJson(res, 500, {
      ok: false,
      error: 'publish_failed',
      message: String((err && err.message) || err || 'Unknown blob publish error')
    });
  }
};
