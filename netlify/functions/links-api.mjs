// netlify/functions/links-api.mjs
// Admin REST API for managing short links
// All endpoints (except /public) require Authorization: Bearer <ADMIN_SECRET>
//
// GET    /api/links/public        — list public links (no auth)
// GET    /api/links/check?code=   — check code availability
// POST   /api/links               — create link { destination, code?, label?, is_public? }
// GET    /api/links               — list all links
// GET    /api/links/:code/stats   — get click stats for a code
// PATCH  /api/links/:code         — update { is_public?, label? }
// DELETE /api/links/:code         — delete a link

import { getStore } from '@netlify/blobs'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const CHARSET  = 'abcdefghjkmnpqrstuvwxyz23456789' // no confusable chars
const RESERVED = ['public', 'check']

function randomCode(len = 5) {
  let code = ''
  for (let i = 0; i < len; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function authCheck(req) {
  const header = req.headers.get('authorization') || ''
  const token  = header.replace('Bearer ', '').trim()
  const secret = process.env.ADMIN_SECRET || ''
  if (!secret || token.length !== secret.length) return false
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret))
  } catch {
    return false
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  })
}

export default async function handler(req) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      }
    })
  }

  const url     = new URL(req.url)
  const rawPath = url.searchParams.get('path') || ''
  const parts   = rawPath.split('/').filter(Boolean)
  const code    = parts[0]
  const subpath = parts[1]

  const store = getStore({ name: 'links', consistency: 'strong' })

  // ── GET /api/links/public — no auth ──────────────────────────────────────────
  if (req.method === 'GET' && code === 'public') {
    let links
    try {
      const { blobs } = await store.list()
      links = (await Promise.all(
        blobs.map(async b => {
          const raw = await store.get(b.key, { type: 'json' }).catch(() => null)
          if (!raw?.is_public) return null
          return {
            code:        raw.code,
            label:       raw.label,
            destination: raw.destination,
            created_at:  raw.created_at,
            short_url:   `https://l.hyphi.art/${b.key}`,
          }
        })
      )).filter(Boolean)
      links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } catch(e) {
      console.error('[Blobs] List error:', e.message)
      return json({ error: 'Failed to load links' }, 500)
    }
    return json({ links })
  }

  if (!authCheck(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── GET /api/links/check/:code — check code availability ─────────────────────
  // Uses path segment (not query string) to avoid redirect-chain forwarding issues
  if (req.method === 'GET' && code === 'check') {
    const q = subpath?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!q) return json({ error: 'code is required' }, 400)
    if (RESERVED.includes(q)) return json({ available: false })
    const existing = await store.get(q).catch(() => null)
    return json({ available: !existing })
  }

  // ── POST /api/links — create ──────────────────────────────────────────────────
  if (req.method === 'POST' && !code) {
    let body
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

    const destination = body.destination?.trim()
    if (!destination) return json({ error: 'destination is required' }, 400)

    // Validate URL and protocol
    let parsedUrl
    try { parsedUrl = new URL(destination) } catch { return json({ error: 'destination must be a valid URL' }, 400) }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return json({ error: 'destination must use http or https' }, 400)
    }

    let slug = (body.code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug) {
      let attempts = 0
      do {
        slug = randomCode(5)
        const existing = await store.get(slug).catch(() => null)
        if (!existing) break
        attempts++
      } while (attempts < 10)
    } else {
      if (RESERVED.includes(slug)) return json({ error: `Code "${slug}" is reserved` }, 400)
      const existing = await store.get(slug).catch(() => null)
      if (existing) return json({ error: `Code "${slug}" is already in use` }, 409)
    }

    const entry = {
      destination,
      code:       slug,
      created_at: new Date().toISOString(),
      label:      body.label || null,
      is_public:  body.is_public ?? false,
    }

    try {
      await store.set(slug, JSON.stringify(entry))
    } catch(e) {
      console.error('[Blobs] Set error:', e.message)
      return json({ error: 'Failed to save link' }, 500)
    }

    // Mirror to Supabase for analytics queries (best-effort)
    const supabase = getSupabase()
    if (supabase) {
      try {
        const { error } = await supabase.from('links').upsert({
          code:        slug,
          destination,
          label:       body.label || null,
          is_public:   entry.is_public,
          created_at:  entry.created_at,
        })
        if (error) console.error('[Supabase] Link upsert error:', error.message)
      } catch(e) {
        console.error('[Supabase] Link upsert error:', e.message)
      }
    }

    return json({ ...entry, short_url: `https://l.hyphi.art/${slug}` }, 201)
  }

  // ── GET /api/links — list all ─────────────────────────────────────────────────
  if (req.method === 'GET' && !code) {
    let links
    try {
      const { blobs } = await store.list()
      links = (await Promise.all(
        blobs.map(async b => {
          const raw = await store.get(b.key, { type: 'json' }).catch(() => null)
          return raw ? { ...raw, click_count: 0, short_url: `https://l.hyphi.art/${b.key}` } : null
        })
      )).filter(Boolean)
      links.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    } catch(e) {
      console.error('[Blobs] List error:', e.message)
      return json({ error: 'Failed to load links' }, 500)
    }

    // Enrich click counts from Supabase (best-effort)
    const supabase = getSupabase()
    if (supabase && links.length > 0) {
      try {
        const codes = links.map(l => l.code)
        const { data, error } = await supabase
          .from('clicks')
          .select('code')
          .in('code', codes)
        if (!error && data) {
          const counts = data.reduce((acc, r) => { acc[r.code] = (acc[r.code] || 0) + 1; return acc }, {})
          for (const l of links) l.click_count = counts[l.code] ?? 0
        }
      } catch(e) {
        console.error('[Supabase] Click count error:', e.message)
      }
    }

    return json({ links })
  }

  // ── GET /api/links/:code/stats ────────────────────────────────────────────────
  if (req.method === 'GET' && code && subpath === 'stats') {
    const supabase = getSupabase()
    if (!supabase) return json({ error: 'Supabase not configured' }, 503)

    const { data: totals } = await supabase
      .from('clicks')
      .select('count')
      .eq('code', code)

    const { data: byDay } = await supabase
      .from('clicks')
      .select('clicked_at')
      .eq('code', code)
      .order('clicked_at', { ascending: false })
      .limit(500)

    const { data: byCountry } = await supabase
      .from('clicks')
      .select('country, count:country.count()')
      .eq('code', code)

    const { data: byReferrer } = await supabase
      .from('clicks')
      .select('referrer, count:referrer.count()')
      .eq('code', code)
      .order('count', { ascending: false })
      .limit(10)

    return json({
      code,
      total_clicks: totals?.[0]?.count ?? 0,
      by_day:       byDay,
      by_country:   byCountry,
      by_referrer:  byReferrer,
    })
  }

  // ── PATCH /api/links/:code — update is_public / label ────────────────────────
  if (req.method === 'PATCH' && code && !subpath) {
    let body
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

    const raw = await store.get(code, { type: 'json' }).catch(() => null)
    if (!raw) return json({ error: 'Link not found' }, 404)

    const updated = {
      ...raw,
      ...(body.label     !== undefined ? { label:     body.label || null           } : {}),
      ...(body.is_public !== undefined ? { is_public: Boolean(body.is_public)      } : {}),
    }

    try {
      await store.set(code, JSON.stringify(updated))
    } catch(e) {
      console.error('[Blobs] Set error:', e.message)
      return json({ error: 'Failed to update link' }, 500)
    }

    const supabase = getSupabase()
    if (supabase) {
      try {
        const { error } = await supabase.from('links')
          .update({ label: updated.label, is_public: updated.is_public })
          .eq('code', code)
        if (error) console.error('[Supabase] Link update error:', error.message)
      } catch(e) {
        console.error('[Supabase] Link update error:', e.message)
      }
    }

    return json({ ...updated, short_url: `https://l.hyphi.art/${code}` })
  }

  // ── DELETE /api/links/:code ───────────────────────────────────────────────────
  if (req.method === 'DELETE' && code) {
    await store.delete(code).catch(() => {})

    const supabase = getSupabase()
    if (supabase) {
      try {
        const { error } = await supabase.from('links').delete().eq('code', code)
        if (error) console.error('[Supabase] Delete error:', error.message)
      } catch(e) {
        console.error('[Supabase] Delete error:', e.message)
      }
    }

    return json({ deleted: code })
  }

  return json({ error: 'Not found' }, 404)
}
