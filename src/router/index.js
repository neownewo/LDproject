import { createRouter, createWebHistory } from 'vue-router'

import Home from '../pages/Home.vue'
import Guides from '../pages/Guides.vue'
import GuidePost from '../pages/GuidePost.vue'

const routes = [
  { path: '/', component: Home },
  { path: '/guides', component: Guides },
  { path: '/guides/:slug', component: GuidePost },
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
