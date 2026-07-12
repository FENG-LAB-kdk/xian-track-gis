import { defineStore } from "pinia";
import type { LngLat } from "@/types/geojson";
import { ref } from "vue";
import type maplibregl from "maplibre-gl";

export const useMapStore = defineStore("map", () => {
  // 全局共享地图参数
  const center = ref<LngLat>([108.95, 34.27]);
  const zoom = ref(11);
  const map = ref<maplibregl.Map | null>(null);

  // 绑定地图实例到全局仓库
  const setMapInstance = (ins: maplibregl.Map) => {
    map.value = ins;
  };

  // 全局飞行定位方法，任意组件可调用
  const flyToTarget = (targetLngLat: LngLat, targetZoom = 13) => {
    if (!map.value) return;
    map.value.flyTo({
      center: targetLngLat,
      zoom: targetZoom,
      duration: 1200,
    });
    // 更新全局中心坐标
    center.value = targetLngLat;
  };

  return {
    center,
    zoom,
    map,
    setMapInstance,
    flyToTarget,
  };
});
