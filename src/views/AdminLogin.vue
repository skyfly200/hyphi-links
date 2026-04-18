<template>
  <div style="max-width:340px;margin:80px auto;text-align:center;padding:0 20px">
    <div class="logo" style="margin-bottom:24px">l.<em>hyphi</em>.art</div>
    <h2 style="font-size:1.2rem;margin-bottom:20px;color:var(--t)">Admin</h2>
    <div style="display:flex;gap:8px">
      <input
        type="password"
        v-model="secret"
        placeholder="Admin secret"
        @keydown.enter="login"
        :disabled="checking"
      />
      <button class="btn-primary" @click="login" :disabled="checking">
        <span v-if="checking" class="spinner"></span>
        {{ checking ? '' : 'Enter' }}
      </button>
    </div>
    <div v-if="error" style="color:var(--rd);font-size:.78rem;margin-top:10px">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router   = useRouter()
const secret   = ref('')
const error    = ref('')
const checking = ref(false)

async function login() {
  if (!secret.value.trim()) return
  checking.value = true
  error.value    = ''
  try {
    const res = await fetch('/api/links', {
      headers: { Authorization: `Bearer ${secret.value.trim()}` }
    })
    if (res.status === 401) {
      error.value = 'Invalid secret'
      return
    }
    localStorage.setItem('hyphi_admin_secret', secret.value.trim())
    router.push('/admin/links')
  } catch {
    error.value = 'Network error — try again'
  } finally {
    checking.value = false
  }
}
</script>
