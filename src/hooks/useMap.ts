import { onMounted, onUnmounted, ref } from "vue";
import maplibregl from "maplibre-gl";
import type { LngLat } from "@/types/geojson";

export function useMap(
  containerId: string,
  initCenter: LngLat = [108.95, 34.27],
  initZoom = 10,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = ref<any>(null);
  // 改用 OpenStreetMap 镜像瓦片（支持跨域，无需密钥，国内连通性好）
  const inlineMapStyle = {
    version: 8 as const,
    sources: {
      osm_source: {
        type: "raster" as const,
        tiles: ["https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    },
    layers: [
      {
        id: "osm-base",
        type: "raster" as const,
        source: "osm_source",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };

  onMounted(() => {
    // DOM挂载完成后初始化地图
    mapInstance.value = new maplibregl.Map({
      container: containerId,
      style: inlineMapStyle,
      center: initCenter,
      zoom: initZoom,
    });
    // 添加缩放、旋转控件
    mapInstance.value.addControl(new maplibregl.NavigationControl());
  });

  // 组件销毁时彻底销毁地图，释放WebGL显存（核心防泄漏代码）
  onUnmounted(() => {
    if (mapInstance.value) {
      mapInstance.value.remove();
      mapInstance.value = null;
      console.log("地图实例已销毁，释放WebGL资源");
    }
  });

  return {
    mapInstance,
  };
}
