import { createRouter, createWebHistory } from "vue-router";

// 页面组件
const MapHome = () => import("@/views/MapHome.vue");
const TrackAnalysis = () => import("@/views/TrackAnalysis.vue");

const routes = [
  {
    path: "/",
    redirect: "/map",
  },
  {
    path: "/map",
    name: "MapHome",
    component: MapHome,
  },
  {
    path: "/track",
    name: "TrackAnalysis",
    component: TrackAnalysis,
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  next();
});

router.afterEach(() => {});

export default router;
