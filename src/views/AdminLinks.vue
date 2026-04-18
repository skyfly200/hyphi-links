<template>
  <div class="shell">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
      <div class="logo">l.<em>hyphi</em>.art <span style="font-size:.7rem;color:var(--mu);font-weight:400">admin</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <RouterLink to="/" style="font-size:.78rem;color:var(--mu);text-decoration:none">Public page</RouterLink>
        <button class="btn-ghost" @click="logout" style="font-size:.75rem">Sign out</button>
      </div>
    </header>

    <!-- Notice -->
    <div v-if="notice.msg" :class="`notice ${notice.type}`">{{ notice.msg }}</div>

    <!-- Create form -->
    <div class="card">
      <div class="section-title">Create short link</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="grid-column:1/-1;display:flex;flex-direction:column;gap:5px">
          <label class="lbl">Destination URL</label>
          <input type="url" v-model="form.destination" placeholder="https://…" />
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <label class="lbl">Short code</label>
          <div style="display:flex;gap:6px">
            <div style="position:relative;flex:1">
              <input
                type="text"
                v-model="form.code"
                placeholder="auto-generated"
                @input="onCodeInput"
                style="font-family:'DM Mono',monospace;padding-right:72px"
              />
              <span
                v-if="codeStatus"
                :style="`position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.68rem;font-family:'DM Mono',monospace;color:${codeStatus==='available'?'var(--gr)':codeStatus==='taken'?'var(--rd)':'var(--mu)'};pointer-events:none`"
              >{{ codeStatus === 'available' ? '✓ free' : codeStatus === 'taken' ? '✗ taken' : '…' }}</span>
            </div>
            <button
              class="btn-ghost"
              @click="rerandomize"
              title="Generate new code"
              style="padding:8px 10px;font-size:.9rem;flex-shrink:0"
            >↻</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          <label class="lbl">Label (optional)</label>
          <input type="text" v-model="form.label" placeholder="e.g. QRForge launch" />
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:.8rem;color:var(--mu);user-select:none">
          <input type="checkbox" v-model="form.is_public" style="width:auto;accent-color:var(--ac)" />
          Public (show on public page)
        </label>
        <button class="btn-primary" @click="createLink" :disabled="creating || codeStatus==='taken'">
          <span v-if="creating" class="spinner"></span>
          {{ creating ? '' : 'Create' }}
        </button>
      </div>
    </div>

    <!-- Links list -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="section-title" style="margin-bottom:0">Links</span>
        <button class="btn-ghost" @click="loadLinks" style="font-size:.72rem;padding:4px 10px">↻ Refresh</button>
      </div>

      <div v-if="loadingLinks" style="text-align:center;padding:32px;color:var(--mu)">
        <span class="spinner"></span> Loading…
      </div>

      <div v-else-if="!links.length" style="text-align:center;padding:32px;color:var(--mu);font-size:.85rem">
        No links yet. Create one above.
      </div>

      <template v-else>
        <div v-for="link in links" :key="link.code">
          <!-- Link row -->
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--bd)">
            <div style="min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">
                <span class="link-code">{{ link.code }}</span>
                <a
                  :href="`https://l.hyphi.art/${link.code}`"
                  target="_blank"
                  style="font-family:'DM Mono',monospace;font-size:.75rem;color:var(--t);background:var(--s2);padding:3px 8px;border-radius:5px;text-decoration:none;border:1px solid var(--bd)"
                >l.hyphi.art/{{ link.code }}</a>
                <span
                  v-if="link.label"
                  style="font-size:.7rem;color:var(--mu);background:var(--s2);padding:2px 7px;border-radius:10px;border:1px solid var(--bd)"
                >{{ link.label }}</span>
                <span
                  v-if="link.is_public"
                  style="font-size:.68rem;color:var(--gr);background:rgba(74,222,128,.08);padding:2px 7px;border-radius:10px;border:1px solid rgba(74,222,128,.2)"
                >public</span>
              </div>
              <div class="link-dest" :title="link.destination">{{ link.destination }}</div>
              <div class="link-meta">{{ formatDate(link.created_at) }}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end">
              <span class="clicks-badge" @click="toggleStats(link.code)">
                {{ link.click_count ?? '—' }} clicks
              </span>
              <button class="btn-ghost" @click="togglePublic(link)" style="font-size:.72rem;padding:4px 10px">
                {{ link.is_public ? 'Make private' : 'Make public' }}
              </button>
              <button class="btn-ghost" @click="copyLink(`https://l.hyphi.art/${link.code}`)" style="font-size:.72rem;padding:4px 10px">Copy</button>
              <button class="btn-danger" @click="deleteLink(link.code)">Delete</button>
            </div>
          </div>

          <!-- Inline expandable stats -->
          <div v-if="openStats === link.code" style="padding:14px 0 8px;border-bottom:1px solid var(--bd)">
            <div v-if="statsLoading" style="color:var(--mu);font-size:.82rem"><span class="spinner"></span> Loading stats…</div>
            <template v-else-if="statsData">
              <div class="stats-grid" style="margin-bottom:14px">
                <div class="stat-box"><div class="stat-val">{{ statsData.total_clicks ?? 0 }}</div><div class="stat-lbl">Total clicks</div></div>
                <div class="stat-box"><div class="stat-val">{{ last24h }}</div><div class="stat-lbl">Last 24h</div></div>
                <div class="stat-box"><div class="stat-val">{{ last7d }}</div><div class="stat-lbl">Last 7 days</div></div>
                <div class="stat-box"><div class="stat-val">{{ (statsData.by_country || []).length }}</div><div class="stat-lbl">Countries</div></div>
              </div>
              <div v-if="(statsData.by_referrer || []).length" style="margin-bottom:12px">
                <div class="lbl" style="margin-bottom:6px">Top referrers</div>
                <div
                  v-for="r in (statsData.by_referrer || []).slice(0, 5)"
                  :key="r.referrer"
                  style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bd);font-size:.78rem"
                >
                  <span style="color:var(--mu)">{{ r.referrer || '(direct)' }}</span>
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
            </template>
            <div v-else style="color:var(--mu);font-size:.82rem">Stats unavailable — Supabase not configured.</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const secret = localStorage.getItem('hyphi_admin_secret') || ''

const CHARSET = 'abcdefghjkmnpqrstuvwxyz23456789'

function generateCode(len = 5) {
  let code = ''
  for (let i = 0; i < len; i++) code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  return code
}

const links        = ref([])
const loadingLinks = ref(true)
const creating     = ref(false)
const openStats    = ref(null)
const statsData    = ref(null)
const statsLoading = ref(false)
const notice       = ref({ msg: '', type: 'ok' })
const codeStatus   = ref('') // '' | 'checking' | 'available' | 'taken'
let   codeTimer    = null

const form = ref({ destination: '', code: '', label: '', is_public: false })

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

async function loadLinks() {
  loadingLinks.value = true
  const data = await api('')
  if (data?.links) links.value = data.links
  else if (data?.error) showNotice(data.error, 'error')
  loadingLinks.value = false
}

async function createLink() {
  if (!form.value.destination) return showNotice('Destination URL is required', 'error')
  creating.value = true
  const data = await api('', {
    method: 'POST',
    body: JSON.stringify({
      destination: form.value.destination,
      code:        form.value.code  || undefined,
      label:       form.value.label || undefined,
      is_public:   form.value.is_public,
    }),
  })
  creating.value = false
  if (!data) return
  if (data.error) return showNotice(data.error, 'error')
  showNotice(`Created: ${data.short_url}`)
  form.value = { destination: '', code: '', label: '', is_public: false }
  await rerandomize()
  await loadLinks()
}

function onCodeInput() {
  clearTimeout(codeTimer)
  const val = form.value.code.trim()
  if (!val) { codeStatus.value = ''; return }
  codeStatus.value = 'checking'
  codeTimer = setTimeout(() => checkCode(val), 400)
}

async function checkCode(val) {
  const data = await api(`/check/${encodeURIComponent(val)}`)
  if (data?.available !== undefined) {
    codeStatus.value = data.available ? 'available' : 'taken'
  } else {
    codeStatus.value = ''
  }
}

async function rerandomize() {
  const code = generateCode()
  form.value.code = code
  codeStatus.value = 'checking'
  await checkCode(code)
}

async function togglePublic(link) {
  const data = await api(`/${link.code}`, {
    method: 'PATCH',
    body:   JSON.stringify({ is_public: !link.is_public }),
  })
  if (!data) return
  if (data.error) return showNotice(data.error, 'error')
  link.is_public = !link.is_public
  showNotice(link.is_public ? `/${link.code} is now public` : `/${link.code} is now private`)
}

async function toggleStats(code) {
  if (openStats.value === code) { openStats.value = null; statsData.value = null; return }
  openStats.value  = code
  statsData.value  = null
  statsLoading.value = true
  const data = await api(`/${code}/stats`)
  statsData.value    = (data && !data.error) ? data : null
  statsLoading.value = false
}

async function deleteLink(code) {
  if (!confirm(`Delete /${code}? This cannot be undone.`)) return
  const data = await api(`/${code}`, { method: 'DELETE' })
  if (!data) return
  if (data.error) return showNotice(data.error, 'error')
  showNotice(`Deleted: /${code}`)
  if (openStats.value === code) { openStats.value = null; statsData.value = null }
  await loadLinks()
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => showNotice(`Copied: ${url}`))
}

function logout() {
  localStorage.removeItem('hyphi_admin_secret')
  router.push('/admin')
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(async () => {
  await Promise.all([loadLinks(), rerandomize()])
})
</script>
