<template>
  <div class="shell">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
      <div class="logo">l.<em>hyphi</em>.art <span style="font-size:.7rem;color:var(--mu);font-weight:400">dashboard</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <RouterLink to="/admin/links" style="font-size:.78rem;color:var(--mu);text-decoration:none">Manage links</RouterLink>
        <button class="btn-ghost" @click="logout" style="font-size:.75rem">Sign out</button>
      </div>
    </header>

    <div v-if="notice.msg" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      <div class="stat-box">
        <div class="stat-val">{{ links.length }}</div>
        <div class="stat-lbl">Total links</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{{ totalClicks }}</div>
        <div class="stat-lbl">Total clicks</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{{ publicLinks }}</div>
        <div class="stat-lbl">Public links</div>
      </div>
    </div>

    <!-- Chart card -->
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="section-title" style="margin-bottom:0">
          {{ selectedCode ? `${selectedCode} — last 30 days` : 'All clicks — last 30 days' }}
        </span>
        <div style="display:flex;gap:6px;align-items:center">
          <button
            v-if="selectedCode"
            class="btn-ghost"
            @click="selectLink(null)"
            style="font-size:.72rem;padding:4px 10px"
          >× All links</button>
          <button
            v-if="selectedCode"
            class="btn-ghost"
            @click="copyPermalink"
            style="font-size:.72rem;padding:4px 10px"
            title="Copy link to this page"
          >⎘ Permalink</button>
        </div>
      </div>

      <div v-if="chartLoading" style="height:80px;display:flex;align-items:center;justify-content:center;color:var(--mu)">
        <span class="spinner"></span>
      </div>
      <template v-else>
        <div
          v-if="chartDays.every(d => d.count === 0)"
          style="height:80px;display:flex;align-items:center;justify-content:center;color:var(--mu);font-size:.82rem;border-bottom:1px solid var(--bd)"
        >No clicks in the last 30 days</div>
        <div v-else style="display:flex;align-items:flex-end;height:80px;gap:1px;border-bottom:1px solid var(--bd)">
          <div
            v-for="d in chartDays"
            :key="d.date"
            :style="`flex:1;background:var(--ac);opacity:.75;height:${d.count / maxDay * 100}%;border-radius:2px 2px 0 0;min-width:0;transition:opacity .15s`"
            :title="`${d.date.slice(5)}: ${d.count} click${d.count !== 1 ? 's' : ''}`"
            style="cursor:default"
          ></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.6rem;color:var(--mu);margin-top:5px;font-family:'DM Mono',monospace">
          <span>{{ chartDays[0]?.date.slice(5) }}</span>
          <span>{{ chartDays[14]?.date.slice(5) }}</span>
          <span>{{ chartDays[29]?.date.slice(5) }}</span>
        </div>
      </template>
    </div>

    <!-- Links list -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="section-title" style="margin-bottom:0">Links by clicks</span>
        <button class="btn-ghost" @click="refresh" style="font-size:.72rem;padding:4px 10px">↻ Refresh</button>
      </div>

      <div v-if="loading" style="text-align:center;padding:32px;color:var(--mu)">
        <span class="spinner"></span> Loading…
      </div>

      <div v-else-if="!links.length" style="text-align:center;padding:32px;color:var(--mu);font-size:.85rem">
        No links yet.
      </div>

      <template v-else>
        <div v-for="link in sortedLinks" :key="link.code">
          <!-- Row -->
          <div
            :style="`display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--bd);cursor:pointer;${selectedCode === link.code ? 'background:var(--acd);margin:0 -20px;padding-left:20px;padding-right:20px;border-radius:4px 4px 0 0' : ''}`"
            @click="selectLink(link.code)"
          >
            <div style="min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
                <span class="link-code">{{ link.code }}</span>
                <a
                  :href="`https://l.hyphi.art/${link.code}`"
                  target="_blank"
                  @click.stop
                  style="font-family:'DM Mono',monospace;font-size:.75rem;color:var(--t);background:var(--s2);padding:3px 8px;border-radius:5px;text-decoration:none;border:1px solid var(--bd)"
                >l.hyphi.art/{{ link.code }}</a>
                <span
                  v-if="link.label"
                  style="font-size:.7rem;color:var(--mu);background:var(--s2);padding:2px 7px;border-radius:10px;border:1px solid var(--bd)"
                >{{ link.label }}</span>
                <span
                  v-if="link.is_public"
                  style="font-size:.65rem;color:var(--gr);background:rgba(74,222,128,.08);padding:2px 7px;border-radius:10px;border:1px solid rgba(74,222,128,.2)"
                >public</span>
              </div>
              <div class="link-dest" :title="link.destination">{{ link.destination }}</div>
              <div class="link-meta">{{ formatDate(link.created_at) }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="clicks-badge">{{ link.click_count ?? 0 }} clicks</span>
              <span style="font-size:.7rem;color:var(--mu)">{{ selectedCode === link.code ? '▲' : '▼' }}</span>
            </div>
          </div>

          <!-- Expanded per-link details -->
          <div v-if="selectedCode === link.code" style="padding:14px 0 8px;border-bottom:1px solid var(--bd)">
            <div v-if="statsLoading" style="color:var(--mu);font-size:.82rem"><span class="spinner"></span> Loading stats…</div>
            <template v-else-if="statsData">
              <div class="stats-grid" style="margin-bottom:14px">
                <div class="stat-box"><div class="stat-val">{{ statsData.total_clicks ?? 0 }}</div><div class="stat-lbl">Total</div></div>
                <div class="stat-box"><div class="stat-val">{{ last24h }}</div><div class="stat-lbl">Last 24h</div></div>
                <div class="stat-box"><div class="stat-val">{{ last7d }}</div><div class="stat-lbl">Last 7d</div></div>
                <div class="stat-box"><div class="stat-val">{{ (statsData.by_country || []).length }}</div><div class="stat-lbl">Countries</div></div>
              </div>
              <div v-if="(statsData.by_referrer||[]).length || (statsData.by_country||[]).length" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                <div v-if="(statsData.by_referrer || []).length">
                  <div class="lbl" style="margin-bottom:6px">Top referrers</div>
                  <div
                    v-for="r in (statsData.by_referrer || []).slice(0, 5)"
                    :key="r.referrer"
                    style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bd);font-size:.78rem"
                  >
                    <span style="color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%">{{ r.referrer || '(direct)' }}</span>
                    <span class="mono" style="color:var(--ac)">{{ r.count }}</span>
                  </div>
                </div>
                <div v-if="(statsData.by_country || []).length">
                  <div class="lbl" style="margin-bottom:6px">Top countries</div>
                  <div
                    v-for="c in (statsData.by_country || []).slice(0, 5)"
                    :key="c.country"
                    style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bd);font-size:.78rem"
                  >
                    <span style="color:var(--mu)">{{ c.country || '(unknown)' }}</span>
                    <span class="mono" style="color:var(--ac)">{{ c.count }}</span>
                  </div>
                </div>
              </div>
              <div v-else style="color:var(--mu);font-size:.82rem">No detailed click data yet.</div>
            </template>
            <div v-else style="color:var(--mu);font-size:.82rem">Stats unavailable — Supabase not configured.</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route  = useRoute()
const secret = localStorage.getItem('hyphi_admin_secret') || ''

const links           = ref([])
const loading         = ref(true)
const selectedCode    = ref(null)
const statsData       = ref(null)
const statsLoading    = ref(false)
const allStats        = ref(null)
const allStatsLoading = ref(true)
const notice          = ref({ msg: '', type: 'ok' })

const sortedLinks = computed(() =>
  [...links.value].sort((a, b) => (b.click_count ?? 0) - (a.click_count ?? 0))
)
const totalClicks = computed(() => links.value.reduce((s, l) => s + (l.click_count ?? 0), 0))
const publicLinks = computed(() => links.value.filter(l => l.is_public).length)

const chartDays = computed(() => {
  const now = Date.now()
  const buckets = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    buckets[d.toISOString().slice(0, 10)] = 0
  }
  const rows = (selectedCode.value && statsData.value)
    ? statsData.value.by_day
    : (allStats.value || [])
  for (const item of rows) {
    const key = item.clicked_at?.slice(0, 10)
    if (key && key in buckets) buckets[key]++
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }))
})

const maxDay      = computed(() => Math.max(...chartDays.value.map(d => d.count), 1))
const chartLoading = computed(() => selectedCode.value ? statsLoading.value : allStatsLoading.value)

const last24h = computed(() => {
  if (!statsData.value?.by_day) return 0
  const cut = Date.now() - 86400000
  return statsData.value.by_day.filter(c => new Date(c.clicked_at) > cut).length
})
const last7d = computed(() => {
  if (!statsData.value?.by_day) return 0
  const cut = Date.now() - 604800000
  return statsData.value.by_day.filter(c => new Date(c.clicked_at) > cut).length
})

function showNotice(msg, type = 'ok') {
  notice.value = { msg, type }
  setTimeout(() => { notice.value = { msg: '', type: 'ok' } }, 3500)
}

async function api(path, options = {}) {
  let res
  try {
    res = await fetch(`/api/links${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', ...options.headers },
    })
  } catch(e) {
    return { error: `Network error: ${e.message}` }
  }
  if (res.status === 401) {
    localStorage.removeItem('hyphi_admin_secret')
    router.push('/admin')
    return null
  }
  try { return await res.json() } catch { return { error: `Server error (${res.status})` } }
}

async function load() {
  loading.value = true
  const data = await api('')
  if (data?.links) links.value = data.links
  else if (data?.error) showNotice(data.error, 'error')
  loading.value = false
}

async function loadAllStats() {
  allStatsLoading.value = true
  const data = await api('/stats')
  allStats.value = (data && !data.error) ? data.clicks : []
  allStatsLoading.value = false
}

async function selectLink(code) {
  if (selectedCode.value === code) {
    selectedCode.value = null
    statsData.value = null
    router.replace({ path: '/dashboard' })
    return
  }
  selectedCode.value = code
  statsData.value = null
  if (!code) {
    router.replace({ path: '/dashboard' })
    return
  }
  router.replace({ path: `/dashboard/${code}` })
  statsLoading.value = true
  const data = await api(`/${code}/stats`)
  statsData.value = (data && !data.error) ? data : null
  statsLoading.value = false
}

function copyPermalink() {
  const url = `${location.origin}/dashboard/${selectedCode.value}`
  navigator.clipboard.writeText(url).then(() => showNotice(`Copied: ${url}`))
}

function logout() {
  localStorage.removeItem('hyphi_admin_secret')
  router.push('/admin')
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function refresh() {
  await Promise.all([load(), loadAllStats()])
  if (selectedCode.value) {
    statsLoading.value = true
    const data = await api(`/${selectedCode.value}/stats`)
    statsData.value = (data && !data.error) ? data : null
    statsLoading.value = false
  }
}

async function init() {
  // Resolve initial code from route param (/dashboard/:code) or query (?code=)
  const initCode = route.params.code || route.query.code || null
  await Promise.all([load(), loadAllStats()])
  if (initCode) await selectLink(String(initCode))
}

init()
</script>
