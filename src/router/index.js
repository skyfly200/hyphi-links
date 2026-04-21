import { createRouter, createWebHistory } from 'vue-router'
import PublicPage  from '../views/PublicPage.vue'
import AdminLogin  from '../views/AdminLogin.vue'
import AdminLinks  from '../views/AdminLinks.vue'
import Dashboard   from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/',             component: PublicPage },
    { path: '/admin',        component: AdminLogin },
    { path: '/admin/links',  component: AdminLinks },
    { path: '/dashboard',    component: Dashboard  },
    { path: '/new',          redirect: to => ({ path: '/admin/links', query: to.query }) },
  ],
})

router.beforeEach((to, _from, next) => {
  const authed = !!localStorage.getItem('hyphi_admin_secret')
  if (to.path === '/admin'       && authed)  return next('/admin/links')
  if (to.path === '/admin/links' && !authed) return next('/admin')
  if (to.path === '/dashboard'   && !authed) return next('/admin')
  next()
})

export default router
