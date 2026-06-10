import { createRouter, createWebHistory } from 'vue-router'

import Home from '../pages/Home.vue'
import Guides from '../pages/Guides.vue'
import GuidePost from '../pages/GuidePost.vue'
import Gacha from '../pages/GachaCalendar.vue'
import Sun from '../pages/Sunteam.vue'
import SunPost from '../pages/SunteamPost.vue'
import Events from '../pages/Events.vue'


const routes = [
  { path: '/', component: Home },
  { path: '/guides', component: Guides },
  {path: '/guide-post',component: GuidePost},
  { path: '/gacha', component: Gacha },
  { path: '/sunteam', component: Sun },
  {path: '/sunteam-post',component: SunPost},
 
  { path: '/events', component: Events },

]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})
