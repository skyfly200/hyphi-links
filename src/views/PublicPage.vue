<template>
  <div class="shell">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px">
      <div class="logo">l.<em>hyphi</em>.art</div>
      <RouterLink to="/admin" style="font-size:.78rem;color:var(--mu);text-decoration:none">Admin →</RouterLink>
    </header>

    <div v-if="loading" class="card" style="text-align:center;padding:40px;color:var(--mu)">
      <span class="spinner"></span> Loading…
    </div>

    <div v-else-if="error" class="notice error">{{ error }}</div>

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

onMounted(async () => {
  try {
    const res  = await fetch('/api/links/public')
    const data = await res.json()
    if (data.error) {
      error.value = `API error: ${data.error}`
    } else {
      links.value = data.links || []
    }
  } catch(e) {
    error.value = `Failed to load links: ${e.message}`
  } finally {
    loading.value = false
  }
})
</script>
