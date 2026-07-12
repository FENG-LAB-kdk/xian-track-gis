import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "maplibre-gl/dist/maplibre-gl.css";

// 引入全局样式 + 地图样式
import "./assets/base.css";

const app = createApp(App);

// 挂载状态库与路由
app.use(createPinia());
app.use(router);

app.mount("#app");
