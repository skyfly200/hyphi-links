<template>
  <div class="shell">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
      <div class="logo">l.<em>hyphi</em>.art</div>
      <RouterLink to="/admin" style="font-size:.78rem;color:var(--mu);text-decoration:none">Admin →</RouterLink>
    </header>

    <div v-if="loading" class="card" style="text-align:center;padding:40px;color:var(--mu)">
      <span class="spinner"></span> Loading…
    </div>

    <div v-else-if="error" class="card" style="text-align:center;padding:40px">
      <div class="notice error" style="margin-bottom:16px">{{ error }}</div>
      <button class="btn-primary" style="padding:7px 18px;font-size:.82rem;border-radius:8px" @click="load">
        Try again
      </button>
    </div>

    <div v-else-if="!links.length" class="card" style="text-align:center;padding:40px;color:var(--mu);font-size:.85rem">
      No public links yet.
    </div>

    <template v-else>
      <div
        v-for="link in links"
        :key="link.code"
        class="card"
        style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"
      >
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <span class="link-code">{{ link.code }}</span>
            <span
              v-if="link.label"
              style="font-size:.7rem;color:var(--mu);background:var(--s2);padding:2px 7px;border-radius:10px;border:1px solid var(--bd)"
            >{{ link.label }}</span>
          </div>
          <div class="link-dest">{{ link.destination }}</div>
        </div>
        <a
          :href="`https://l.hyphi.art/${link.code}`"
          target="_blank"
          class="btn-primary"
          style="text-decoration:none;padding:7px 18px;font-size:.82rem;border-radius:8px;white-space:nowrap;flex-shrink:0"
        >Visit →</a>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const links   = ref([])
const loading = ref(true)
const error   = ref('')

async function load() {
  loading.value = true
  error.value   = ''
  try {
    const res = await fetch('/api/links/public')

    // Parse defensively — a crashed function may return HTML, not JSON
    let data = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      error.value = data?.error
        ? `Couldn’t load links: ${data.error}`
        : `Couldn’t load links (server returned ${res.status}). Please try again.`
      return
    }

    if (data?.error) {
      error.value = `Couldn’t load links: ${data.error}`
      return
    }

    links.value = Array.isArray(data?.links) ? data.links : []
  } catch (e) {
    error.value = navigator.onLine
      ? 'Couldn’t reach the server. Please try again in a moment.'
      : 'You appear to be offline. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
