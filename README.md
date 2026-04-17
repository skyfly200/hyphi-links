# hyphi-links

Link shortener for `l.hyphi.art` — built on Netlify Functions, Netlify Blobs, Supabase, and GA4 Measurement Protocol.

## Architecture

```
l.hyphi.art/:code
  → Netlify Function (redirect.mjs)
    → lookup code in Netlify Blobs
    → fire GA4 Measurement Protocol event (async, non-blocking)
    → log click to Supabase (async, non-blocking)
    → 302 → destination

/admin → static admin UI (public/admin/index.html)
  → calls /api/links via links-api.mjs function
```

---

## Setup

### 1. Create Netlify site

```bash
# In your hyphi repos directory
git clone <this repo> hyphi-links
cd hyphi-links
npm install

# Deploy to Netlify
netlify login
netlify init
# Choose: Create & configure a new site
# Build command: npm run build
# Publish directory: dist
```

### 2. Add custom domain

In Netlify dashboard → Domain management → Add domain: `l.hyphi.art`

In your DNS (wherever hyphi.art is managed):
```
CNAME  l  <your-netlify-site>.netlify.app
```

### 3. Create Supabase project

1. Go to supabase.com → New project
2. Note your **Project URL** and **service_role key** (Settings → API)
3. Open SQL Editor → paste contents of `supabase-schema.sql` → Run

### 4. Get GA4 Measurement Protocol credentials

1. GA4 dashboard → Admin → Data Streams → your stream
2. Note your **Measurement ID** (G-XXXXXXXXXX)
3. Scroll to "Measurement Protocol API secrets" → Create → note the **secret value**

### 5. Set environment variables in Netlify

Netlify dashboard → Site configuration → Environment variables → Add:

| Variable | Value |
|---|---|
| `ADMIN_SECRET` | A strong random string — this is your admin password |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service_role key (not anon) |
| `GA_MEASUREMENT_ID` | G-XXXXXXXXXX |
| `GA_API_SECRET` | Your Measurement Protocol API secret |

For local dev, create `.env` (git-ignored):
```env
ADMIN_SECRET=your-secret-here
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA_API_SECRET=your-mp-secret
```

### 6. Deploy

```bash
git add -A && git commit -m "init" && git push
# Netlify auto-deploys on push
```

---

## Usage

### Admin UI

Visit `https://l.hyphi.art/admin` → enter your `ADMIN_SECRET` → manage links.

### API (direct)

```bash
# Create a link
curl -X POST https://l.hyphi.art/api/links \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"destination":"https://hyphi.art/products/gloflora","label":"Gloflora launch"}'

# Response:
# {"code":"xk3p2","destination":"https://...","short_url":"https://l.hyphi.art/xk3p2"}

# Create with custom code
curl -X POST https://l.hyphi.art/api/links \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"destination":"https://hyphi.art","code":"home"}'

# List all links
curl https://l.hyphi.art/api/links \
  -H "Authorization: Bearer YOUR_SECRET"

# Get stats for a code
curl https://l.hyphi.art/api/links/xk3p2/stats \
  -H "Authorization: Bearer YOUR_SECRET"

# Delete a link
curl -X DELETE https://l.hyphi.art/api/links/xk3p2 \
  -H "Authorization: Bearer YOUR_SECRET"
```

---

## Integration with QRForge

When generating a QR code in QRForge, set the Content Type to **URL / Link** and paste `https://l.hyphi.art/your-code`. The QR encodes the short URL — when someone scans it, the redirect fires and logs the click before bouncing them to the destination.

This means you can update where a QR points **without reprinting it** — just update the destination in the admin panel.

---

## Analytics

**In GA4:** Link clicks appear as `link_click` events with custom dimensions `short_code`, `destination`, and `referrer`. Find them under Events in your GA4 dashboard.

**In Supabase:** Query the `link_stats` view for a full breakdown:
```sql
select * from link_stats order by total_clicks desc;
```

Or raw clicks with time-series:
```sql
select
  date_trunc('day', clicked_at) as day,
  code,
  count(*) as clicks
from clicks
where clicked_at > now() - interval '30 days'
group by 1, 2
order by 1 desc;
```

---

## Notes

- **No raw IPs stored** — only a short hash for deduplication purposes
- **Supabase free tier** pauses after 1 week of inactivity — the first click after a pause will still redirect instantly (Blobs lookup is independent), but the analytics log for that click may be delayed while Supabase wakes up
- **GA Measurement Protocol** events may take 24–48h to appear in standard GA reports; they show up immediately in DebugView if you append `&debug_mode=1` to the MP endpoint during testing
