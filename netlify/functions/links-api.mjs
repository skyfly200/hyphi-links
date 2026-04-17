// netlify/functions/links-api.mjs
// Admin REST API for managing short links
// All endpoints require Authorization: Bearer <ADMIN_SECRET>
//
// POST   /api/links           — create link { destination, code? }
// GET    /api/links           — list all links
// DELETE /api/links/:code     — delete a link
// GET    /api/links/:code/stats — get click stats for a code

import { getStore, listStores } from '@netlify/blobs'
import { createClient } from '@supabase/supabase-js'

const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789' // no confusable chars

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
  return token === process.env.ADMIN_SECRET
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
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      }
    })
  }

  if (!authCheck(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url     = new URL(req.url)
  // Support both routing modes:
  //   via netlify.toml redirect: ?path=abc123/stats
  //   via function path config:  /api/links/abc123/stats
  const rawPath = url.searchParams.get('path') ||
                  (url.pathname.startsWith('/api/links')
                    ? url.pathname.slice('/api/links'.length).replace(/^\//, '')
                    : '')
  const parts   = rawPath.split('/').filter(Boolean)
  const code    = parts[0]
  const subpath = parts[1] // e.g. 'stats'

  const store = getStore({ name: 'links', consistency: 'strong' })

  // ── POST /api/links — create ──────────────────────────────────────────────
  if (req.method === 'POST' && !code) {
    let body
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

    const destination = body.destination?.trim()
    if (!destination) return json({ error: 'destination is required' }, 400)

    // Validate URL
    try { new URL(destination) } catch { return json({ error: 'destination must be a valid URL' }, 400) }

    // Use provided code or generate one
    let slug = (body.code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!slug) {
      // Generate unique code
      let attempts = 0
      do {
        slug = randomCode(5)
        const existing = await store.get(slug).catch(() => null)
        if (!existing) break
        attempts++
      } while (attempts < 10)
    } else {
      // Check custom code isn't taken
      const existing = await store.get(slug).catch(() => null)
      if (existing) return json({ error: `Code "${slug}" is already in use` }, 409)
    }

    const entry = {
      destination,
      code:       slug,
      created_at: new Date().toISOString(),
      label:      body.label || null,
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
          created_at:  entry.created_at,
        })
        if (error) console.error('[Supabase] Link upsert error:', error.message)
      } catch(e) {
        console.error('[Supabase] Link upsert error:', e.message)
      }
    }

    return json({ ...entry, short_url: `https://l.hyphi.art/${slug}` }, 201)
  }

  // ── GET /api/links — list all ─────────────────────────────────────────────
  if (req.method === 'GET' && !code) {
    // Blobs is the source of truth — Supabase sync may lag or fail
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

    // Enrich click counts from Supabase (best-effort, doesn't need links in Supabase)
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

  // ── GET /api/links/:code/stats ────────────────────────────────────────────
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

  // ── DELETE /api/links/:code ───────────────────────────────────────────────
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
