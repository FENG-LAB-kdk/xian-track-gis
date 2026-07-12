<template>
  <div class="map-page">
    <h3>西安轨迹分析地图主页</h3>
    <div
      id="map-container"
      style="width: 100%; height: calc(100vh - 54px); border: 1px solid #dcdcdc"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useMap } from "@/hooks/useMap";
import { useMapStore } from "@/stores/map";
import type { LngLat } from "@/types/geojson";
import { wgs84ToGcj02, gcj02ToWgs84 } from "@/utils/coordTransform";

// 使用 WGS-84 坐标初始化；但天地图是 GCJ-02 坐标系，
// 因此需要将 WGS-84 转为 GCJ-02 作为初始中心点，否则会有几百米偏移
const wgsCenter: LngLat = [108.95, 34.27];
const gcjCenter = wgs84ToGcj02(wgsCenter[0], wgsCenter[1]);
const { mapInstance } = useMap("map-container", gcjCenter, 10);
const mapStore = useMapStore();

onMounted(() => {
  mapInstance.value?.on("load", () => {
    mapStore.setMapInstance(mapInstance.value! as any);
    console.log("地图实例已存入全局Pinia仓库");
  });

  // 坐标转换测试逻辑保持原样
  const wgs: LngLat = [108.9, 34.24];
  const gcj = wgs84ToGcj02(wgs[0], wgs[1]);
  const revertWgs = gcj02ToWgs84(gcj[0], gcj[1]);
  if (Array.isArray(revertWgs)) {
    // 处理数组返回值
  } else {
    console.error("坐标转换失败", revertWgs);
  }
  console.log("WGS原始坐标:", wgs);
  console.log("转换GCJ02火星坐标:", gcj);
  console.log("转回WGS84:", revertWgs);
});
</script>

<style scoped>
.map-page {
  width: 100%;
  /* 使用 calc(100vh - 54px) 减去底部多余空间，实际父链不影响 */
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0 12px 12px;
}
</style>
