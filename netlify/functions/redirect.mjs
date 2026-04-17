// netlify/functions/redirect.mjs
// Handles GET /:code → lookup → log analytics → 302 to destination
//
// Required env vars (set in Netlify dashboard → Site config → Environment variables):
//   ADMIN_SECRET          — shared secret for admin API calls
//   SUPABASE_URL          — your Supabase project URL
//   SUPABASE_SERVICE_KEY  — Supabase service role key (not anon key)
//   GA_MEASUREMENT_ID     — e.g. G-XXXXXXXXXX
//   GA_API_SECRET         — Measurement Protocol API secret from GA4 dashboard

import { getStore } from '@netlify/blobs'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase client ─────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// ─── GA Measurement Protocol ─────────────────────────────────────────────────
async function sendGAEvent({ code, destination, userAgent, ip, referrer }) {
  const measurementId = process.env.GA_MEASUREMENT_ID
  const apiSecret     = process.env.GA_API_SECRET
  if (!measurementId || !apiSecret) return

  // Use a stable anonymous client ID derived from IP (no PII stored)
  const clientId = `shortlink-${Buffer.from(ip || 'unknown').toString('base64').slice(0, 16)}`

  const payload = {
    client_id: clientId,
    non_personalized_ads: true,
    events: [{
      name: 'link_click',
      params: {
        short_code:  code,
        destination: destination,
        referrer:    referrer || '(direct)',
        engagement_time_msec: 1,
      }
    }]
  }

  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }
    )
  } catch (err) {
    console.error('[GA] Measurement Protocol error:', err.message)
  }
}

// ─── Supabase click log ───────────────────────────────────────────────────────
async function logClick({ code, destination, userAgent, ip, referrer, country }) {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    await supabase.from('clicks').insert({
      code,
      destination,
      user_agent:  userAgent  || null,
      referrer:    referrer   || null,
      country:     country    || null,
      // Store only a hash of the IP — not the IP itself
      ip_hash:     ip ? Buffer.from(ip).toString('base64').slice(0, 16) : null,
      clicked_at:  new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Supabase] Click log error:', err.message)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, context) {
  // Extract short code from the URL path
  const url  = new URL(req.url)
  const code = url.pathname.replace(/^\//, '').split('/')[0]

  if (!code || code === 'favicon.ico') {
    return new Response('Not found', { status: 404 })
  }

  // Look up the code in Netlify Blobs
  const store = getStore({ name: 'links', consistency: 'strong' })
  let entry

  try {
    const raw = await store.get(code, { type: 'json' })
    entry = raw
  } catch {
    entry = null
  }

  if (!entry || !entry.destination) {
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><title>Link not found</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#080810;color:#ddddf0}
      .box{text-align:center}.logo{font-size:2rem;font-weight:800;margin-bottom:8px}em{color:#b48eff;font-style:normal}
      p{color:#55556a;margin-top:8px}a{color:#b48eff}</style></head>
      <body><div class="box"><div class="logo">l.<em>hyphi</em>.art</div>
      <p>This link doesn't exist or has expired.</p>
      <p><a href="https://hyphi.art">← hyphi.art</a></p></div></body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } }
    )
  }

  // Gather request metadata for analytics
  const userAgent = req.headers.get('user-agent') || ''
  const referrer  = req.headers.get('referer')    || ''
  const ip        = context.ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || ''
  const country   = context.geo?.country?.code    || req.headers.get('x-country')           || ''

  // Fire analytics in parallel — don't await, don't block the redirect
  Promise.all([
    logClick({ code, destination: entry.destination, userAgent, ip, referrer, country }),
    sendGAEvent({ code, destination: entry.destination, userAgent, ip, referrer }),
  ]).catch(err => console.error('[Analytics] Error:', err.message))

  // Redirect
  return new Response(null, {
    status: 302,
    headers: {
      Location:      entry.destination,
      'Cache-Control': 'no-store, no-cache',
    }
  })
}

export const config = {
  path: '/:code',
  excludedPath: ['/admin', '/admin/*', '/favicon.ico', '/.netlify/*'],
}
