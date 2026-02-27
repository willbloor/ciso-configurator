const { list } = require('@vercel/blob');

function toSlug(value){
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function queryValue(input){
  if(Array.isArray(input)) return String(input[0] || '');
  return String(input || '');
}

function sendJson(res, statusCode, payload){
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res){
  if(req.method !== 'GET'){
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, {
      ok: false,
      error: 'method_not_allowed'
    });
  }

  if(!process.env.BLOB_READ_WRITE_TOKEN){
    return sendJson(res, 500, {
      ok: false,
      error: 'blob_token_missing',
      message: 'Set BLOB_READ_WRITE_TOKEN in Vercel project environment variables.'
    });
  }

  const slug = toSlug(queryValue(req.query && req.query.slug));
  if(!slug){
    return sendJson(res, 400, {
      ok: false,
      error: 'slug_required'
    });
  }

  const pathname = `customer-pages/${slug}.html`;
  try{
    const result = await list({
      prefix: pathname,
      limit: 5
    });
    const blobs = Array.isArray(result && result.blobs) ? result.blobs : [];
    const match = blobs.find((blob)=> String(blob && blob.pathname || '').trim() === pathname);
    if(!match || !match.url){
      return sendJson(res, 404, {
        ok: false,
        error: 'not_found',
        slug
      });
    }
    const redirectUrl = String(match.url || '').trim();
    if(!/^https:\/\/.+/i.test(redirectUrl)){
      return sendJson(res, 502, {
        ok: false,
        error: 'invalid_blob_url'
      });
    }
    res.statusCode = 307;
    res.setHeader('Location', redirectUrl);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.end();
  }catch(err){
    return sendJson(res, 500, {
      ok: false,
      error: 'resolve_failed',
      message: String((err && err.message) || err || 'Unknown blob resolve error')
    });
  }
};
