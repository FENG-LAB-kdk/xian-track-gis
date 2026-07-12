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
  // 将自己拿到的天地图tk填入下面url
  const TIANDITU_TK = import.meta.env.VITE_TIANDITU_TK as string;
  const inlineMapStyle = {
    version: 8 as const,
    sources: {
      tiandituVec: {
        type: "raster" as const,
        tiles: [
          `https://t0.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${TIANDITU_TK}`,
        ],
        tileSize: 256,
      },
      tiandituCva: {
        type: "raster" as const,
        tiles: [
          `https://t0.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${TIANDITU_TK}`,
        ],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "tianditu-base",
        type: "raster" as const,
        source: "tiandituVec",
      },
      {
        id: "tianditu-cva",
        type: "raster" as const,
        source: "tiandituCva",
      },
    ],
  };

  onMounted(() => {
    // DOM挂载完成后初始化地图
    mapInstance.value = new maplibregl.Map({
      container: containerId,
      // 使用内联天地图样式（自动注入 TK）
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
