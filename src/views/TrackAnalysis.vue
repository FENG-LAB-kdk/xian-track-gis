<template>
  <div class="analysis-page">
    <div class="filter-bar">
      <h4 class="filter-title">轨迹多维筛选区</h4>
      <div class="filter-row">
        <select
          v-model="selectedCar"
          @change="handleCarFilter"
          :disabled="loading || playing"
        >
          <option value="">全部车辆</option>
          <option v-for="item in carList" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
        <input
          type="datetime-local"
          v-model="startTime"
          @change="handleTimeFilter"
          :disabled="loading || playing"
        />
        <input
          type="datetime-local"
          v-model="endTime"
          @change="handleTimeFilter"
          :disabled="loading || playing"
        />
        <button @click="resetFilter" :disabled="loading || playing">
          重置筛选
        </button>
        <button
          v-if="trackPoints.length > 0"
          class="play-btn"
          @click="togglePlay"
          :disabled="loading"
        >
          {{ playing ? "暂停播放" : "播放轨迹" }}
        </button>
        <span class="hint-text">直接拖拽地图绘制矩形，完成空间范围筛选</span>
      </div>
      <div class="status-row">
        <span v-if="loading" class="loading-tip">正在加载轨迹数据...</span>
        <span v-if="emptyTip" class="empty-tip"
          >当前筛选条件暂无轨迹，请更换筛选参数</span
        >
        <span
          v-if="trackPoints.length > 0 && !loading && !emptyTip"
          class="stats-text"
          >共获取 <b>{{ trackPoints.length }}</b> 个GPS采样点</span
        >
      </div>
    </div>
    <div id="mapContainer"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from "vue";
import maplibregl, { Popup } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import {
  getTrackByCar,
  getTrackByTime,
  getTrackByBbox,
  getCarList,
  getTrackByAdvanced,
} from "@/api/trackApi";

let map: maplibregl.Map | undefined;
let playTimer: ReturnType<typeof setInterval> | null = null;
// 弹窗缓存列表，手动管理替代 map.popups()
const popupList: Popup[] = [];
// 框选矩形相关变量
let isDrag = false;
let startLngLat: maplibregl.LngLat;
const selectBoxSourceId = "drag-select-box-source";
const selectBoxLayerId = "drag-select-box-layer";
const selectedCar = ref("");
const startTime = ref("");
const endTime = ref("");
const carList = ref<string[]>([]);
const loading = ref(false);
const emptyTip = ref(false);
const playing = ref(false);
// 完整有序轨迹点数组，用于动画播放
const trackPoints = ref<any[]>([]);
// 当前播放点位下标
const playIndex = ref(0);

// WKT解析增强容错 — 兼容POINT、POINT Z、SRID前缀 + NaN兜底退回西安默认坐标
const parseWktPoint = (wkt: string | undefined | null): [number, number] => {
  const defaultCoord: [number, number] = [108.95, 34.27];
  if (!wkt || typeof wkt !== "string") return defaultCoord;
  // 移除SRID前缀如 "SRID=4326;POINT(...)" 及处理 "POINT Z (...)", "POINT(...)" 等情况
  const cleaned = wkt.replace(/^SRID=\d+;/i, "").trim();
  // 兼容 POINT (x y), POINT(x y), POINT Z (x y z) 等格式
  let matchArr = cleaned.match(/POINT\s*Z?\s*\((.+?)\)/i);
  if (matchArr) {
    const parts = matchArr[1].trim().split(/\s+/);
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    return [
      Number.isFinite(lng) ? lng : defaultCoord[0],
      Number.isFinite(lat) ? lat : defaultCoord[1],
    ];
  }
  // 备用匹配：直接数字对 (容错)
  matchArr = cleaned.match(/\(?\s*([\d.-]+)\s+([\d.-]+)/);
  if (matchArr) {
    const lng = Number(matchArr[1]);
    const lat = Number(matchArr[2]);
    return [
      Number.isFinite(lng) ? lng : defaultCoord[0],
      Number.isFinite(lat) ? lat : defaultCoord[1],
    ];
  }
  return defaultCoord;
};

// 前端简易轨迹抽稀函数
const simplifyTrack = (rows: any[], step = 3) => {
  return rows.filter((_, idx) => idx % step === 0);
};

// 动态自适应视野 — 根据轨迹点极值自动适配可视范围
const fitTrackBounds = (points: number[][]) => {
  if (!map || points.length === 0) return;
  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;
  points.forEach(([lng, lat]) => {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });
  // 给边界预留留白，避免轨迹紧贴地图边缘
  map.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 60, duration: 500 },
  );
};

// 绘制拖拽选区矩形 — 复用Source仅更新data，避免反复删建图层导致卡顿
const renderSelectionBox = (
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number,
) => {
  if (!map) return;
  const polygonCoords = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ];
  const boxGeo = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [polygonCoords] },
  };
  // 存在Source就只更新data，不再删图层
  if (map.getSource(selectBoxSourceId)) {
    (map.getSource(selectBoxSourceId) as maplibregl.GeoJSONSource).setData(
      boxGeo as any,
    );
  } else {
    // 仅首次拖拽时创建一次图层
    map.addSource(selectBoxSourceId, {
      type: "geojson",
      data: boxGeo as any,
    });
    map.addLayer({
      id: selectBoxLayerId,
      source: selectBoxSourceId,
      type: "fill",
      paint: { "fill-color": "#409eff", "fill-opacity": 0.12 },
    });
    map.addLayer({
      id: selectBoxLayerId + "-border",
      source: selectBoxSourceId,
      type: "line",
      paint: { "line-color": "#1867c0", "line-width": 1.5 },
    });
  }
};

// 清除选区矩形
const clearSelectionBox = () => {
  if (!map) return;
  if (map.getLayer(selectBoxLayerId + "-border"))
    map.removeLayer(selectBoxLayerId + "-border");
  if (map.getLayer(selectBoxLayerId)) map.removeLayer(selectBoxLayerId);
  if (map.getSource(selectBoxSourceId)) map.removeSource(selectBoxSourceId);
};

// 清空所有地图图层
const clearAllLayers = () => {
  if (!map) return;
  if (map.getLayer("trackLineLayer")) map.removeLayer("trackLineLayer");
  if (map.getSource("trackLineSource")) map.removeSource("trackLineSource");
  if (map.getLayer("trackLayer")) map.removeLayer("trackLayer");
  if (map.getSource("trackSource")) map.removeSource("trackSource");
  if (map.getLayer("animatePointLayer")) map.removeLayer("animatePointLayer");
  if (map.getSource("animatePointSource"))
    map.removeSource("animatePointSource");
  popupList.forEach((popup) => popup.remove());
  popupList.length = 0;
  clearSelectionBox();
};

// 轨迹渲染重构
const renderTrack = (rows: any[] | null | undefined) => {
  if (!map) return;
  emptyTip.value = false;
  // 兜底数组判断，修复filter undefined报错
  if (!Array.isArray(rows)) {
    emptyTip.value = true;
    clearAllLayers();
    trackPoints.value = [];
    return;
  }
  // 过滤脏数据 + 前端抽稀
  let validRows = rows.filter((item) => item && item.geom_wkt);
  validRows = simplifyTrack(validRows, 7);
  if (validRows.length === 0) {
    emptyTip.value = true;
    clearAllLayers();
    trackPoints.value = [];
    return;
  }
  // 按时间升序排序，存储完整有序点位用于动画
  trackPoints.value = validRows.sort((a, b) => {
    const timeDiff =
      new Date(a.collect_time).getTime() - new Date(b.collect_time).getTime();
    if (timeDiff !== 0) return timeDiff;
    // 时间戳相同时按id排序兜底，避免同时间点位连线乱序
    if (a.id !== undefined && b.id !== undefined)
      return Number(a.id) - Number(b.id);
    return 0;
  });
  playIndex.value = 0;
  stopPlay();

  const pointGeo = {
    type: "FeatureCollection",
    features: trackPoints.value.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: parseWktPoint(item.geom_wkt) },
      properties: {
        car_no: item.car_no,
        speed: item.speed,
        time: item.collect_time,
      },
    })),
  };

  const lineCoords = trackPoints.value.map((item) =>
    parseWktPoint(item.geom_wkt),
  );
  const lineGeo = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: lineCoords },
      },
    ],
  };

  // 生成轨迹坐标数组用于自适应视野
  const trackLngLat = trackPoints.value.map((item) =>
    parseWktPoint(item.geom_wkt),
  );

  clearAllLayers();

  // 静态轨迹线
  map.addSource("trackLineSource", { type: "geojson", data: lineGeo as any });
  map.addLayer({
    id: "trackLineLayer",
    type: "line",
    source: "trackLineSource",
    paint: {
      "line-color": "#ff4444",
      "line-width": 3,
    },
  });

  // 静态点位图层
  map.addSource("trackSource", { type: "geojson", data: pointGeo as any });
  map.addLayer(
    {
      id: "trackLayer",
      type: "circle",
      source: "trackSource",
      paint: {
        "circle-radius": 5,
        "circle-color": "#2385bb",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    },
    "trackLineLayer",
  );

  // 动画小车点位图层
  map.addSource("animatePointSource", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer(
    {
      id: "animatePointLayer",
      type: "circle",
      source: "animatePointSource",
      paint: {
        "circle-radius": 8,
        "circle-color": "#ffdd00",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#fff",
      },
    },
    "trackLayer",
  );

  // 点位悬浮弹窗 - 绑定具名函数以便后续清理
  if (!(map as any).__popupBound) {
    (map as any).__popupBound = true;
    const onMouseEnter = (e: any) => {
      if (!e.features || !e.features[0]) return;
      const props = e.features[0].properties;
      const currentPopup = new Popup({ offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(
          `
          <div style="min-width:140px;font-size:13px;line-height:1.8;">
            <div><b>车牌：</b>${props.car_no}</div>
            <div><b>车速：</b>${props.speed ?? "暂无数据"} km/h</div>
            <div><b>采集时间：</b>${props.time}</div>
          </div>
        `,
        )
        .addTo(map!);
      popupList.push(currentPopup);
      map!.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map!.getCanvas().style.cursor = "";
      popupList.forEach((popup) => popup.remove());
      popupList.length = 0;
    };
    map.on("mouseenter", "trackLayer", onMouseEnter);
    map.on("mouseleave", "trackLayer", onMouseLeave);
  }

  // 自动缩放视野包住所有轨迹
  fitTrackBounds(trackLngLat);
};

// 停止播放动画
const stopPlay = () => {
  playing.value = false;
  if (playTimer) clearInterval(playTimer);
  playTimer = null;
};

// 播放/暂停切换
const togglePlay = () => {
  if (!map || trackPoints.value.length === 0) return;
  if (playing.value) {
    stopPlay();
    return;
  }
  playing.value = true;
  playIndex.value = 0;
  // 动画定时器，每150ms前进一个点位
  playTimer = window.setInterval(() => {
    if (playIndex.value >= trackPoints.value.length) {
      stopPlay();
      return;
    }
    const currentPoint = trackPoints.value[playIndex.value];
    const coords = parseWktPoint(currentPoint.geom_wkt);
    // 更新动画点位
    (map!.getSource("animatePointSource") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: coords },
          properties: {},
        },
      ],
    } as FeatureCollection);
    // 地图跟随小车移动
    map!.flyTo({ center: coords as [number, number], zoom: 12, speed: 0.8 });
    playIndex.value += 1;
  }, 150);
};

// 重置所有筛选条件
const resetFilter = () => {
  selectedCar.value = "";
  startTime.value = "";
  endTime.value = "";
  trackPoints.value = [];
  stopPlay();
  clearAllLayers();
  emptyTip.value = false;
  // 重置视野到西安默认位置
  if (map) map.jumpTo({ center: [108.95, 34.27], zoom: 11 });
};

// 车牌筛选
const handleCarFilter = async () => {
  if (!map || loading.value || playing.value) return;
  loading.value = true;
  emptyTip.value = false;
  stopPlay();
  try {
    let res;
    if (selectedCar.value) {
      res = await getTrackByCar(selectedCar.value);
    } else {
      res = await getTrackByAdvanced();
    }
    // 注意: request.ts响应拦截器已剥axios层(resp.data), res就是后端json {code,msg,data}
    // 所以直接取 res.data (后端响应的data字段)即可
    const trackRows = (res as any)?.data ?? res ?? [];
    renderTrack(trackRows);
  } catch (err) {
    console.error("车牌筛选请求失败", err);
    emptyTip.value = true;
  } finally {
    loading.value = false;
  }
};

// 时间筛选
const handleTimeFilter = async () => {
  if (
    !startTime.value ||
    !endTime.value ||
    !map ||
    loading.value ||
    playing.value
  )
    return;
  loading.value = true;
  emptyTip.value = false;
  stopPlay();
  try {
    const res = await getTrackByTime(startTime.value, endTime.value);
    // 注意: request.ts响应拦截器已剥axios层(resp.data), res就是后端json {code,msg,data}
    // 所以直接取 res.data (后端响应的data字段)即可
    const trackRows = (res as any)?.data ?? res ?? [];
    renderTrack(trackRows);
  } catch (err) {
    console.error("时间筛选请求失败", err);
    emptyTip.value = true;
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // 初始化车牌列表
  try {
    const carRes = await getCarList();
    // carRes 是响应拦截器返回的 {code, msg, data}, carRes.data 即车牌列表
    carList.value = (carRes as any)?.data ?? [];
  } catch (e) {
    console.error("车牌列表加载失败", e);
  }

  map = new maplibregl.Map({
    container: "mapContainer",
    style: "https://demotiles.maplibre.org/style.json",
    center: [108.95, 34.27],
    zoom: 11,
    attributionControl: false,
    maxTileCacheSize: 52428800,
    maxBounds: [
      [107.5, 33.2],
      [110.5, 35.3],
    ],
  });

  // 屏蔽雪碧图加载失败告警
  map.on("styleimagemissing", (e: any) => e.preventDefault?.());

  // 新增标准地图控件：缩放、全屏、比例尺
  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.addControl(new maplibregl.FullscreenControl(), "top-right");
  map.addControl(
    new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
    "bottom-left",
  );

  // 拖拽框选逻辑 — 三重降噪：40ms防抖 + 简化矩形渲染 + 拖拽时隐藏轨迹图层
  map.on("mousedown", (downEvt) => {
    if (loading.value || playing.value) return;
    if (!downEvt.lngLat) return;
    downEvt.preventDefault();
    if (map) {
      map.dragPan.disable(); // 拖拽阶段禁止地图平移
      // 拖拽开始，隐藏轨迹图层，减少画面渲染内容
      if (map.getLayer("trackLineLayer"))
        map.setLayoutProperty("trackLineLayer", "visibility", "none");
      if (map.getLayer("trackLayer"))
        map.setLayoutProperty("trackLayer", "visibility", "none");
    }
    isDrag = true;
    startLngLat = downEvt.lngLat;
  });

  // 松开鼠标触发筛选查询
  map.on("mouseup", async (upEvt) => {
    if (!isDrag || !map) {
      if (map) map.dragPan.enable();
      return;
    }
    isDrag = false;
    map.dragPan.enable(); // 放开地图平移权限

    loading.value = true;
    emptyTip.value = false;
    stopPlay();

    const endLngLat = upEvt.lngLat;
    const minLng = Math.min(startLngLat.lng, endLngLat.lng);
    const maxLng = Math.max(startLngLat.lng, endLngLat.lng);
    const minLat = Math.min(startLngLat.lat, endLngLat.lat);
    const maxLat = Math.max(startLngLat.lat, endLngLat.lat);

    // 方案1：仅松手后一次性绘制选区矩形，拖拽过程无实时预览
    renderSelectionBox(minLng, maxLng, minLat, maxLat);

    try {
      // 如果当前已选中车牌，一并传入实现联合过滤（仅框内该车点位）
      const carNoParam = selectedCar.value || undefined;
      const res = await getTrackByBbox(
        String(minLng),
        String(maxLng),
        String(minLat),
        String(maxLat),
        carNoParam,
      );
      const trackRows = (res as any)?.data ?? res ?? [];
      renderTrack(trackRows);
    } catch (err) {
      console.error("空间框选查询失败", err);
      emptyTip.value = true;
    } finally {
      // 请求完成抹去选区矩形
      clearSelectionBox();
      loading.value = false;
      // 拖拽结束，恢复轨迹图层显示
      if (map && map.getLayer("trackLineLayer"))
        map.setLayoutProperty("trackLineLayer", "visibility", "visible");
      if (map && map.getLayer("trackLayer"))
        map.setLayoutProperty("trackLayer", "visibility", "visible");
    }
  });
});

// 路由离开销毁所有资源
onUnmounted(() => {
  stopPlay();
  clearSelectionBox();
  if (map) {
    map.remove();
    map = undefined;
  }
});
</script>

<style scoped>
#mapContainer {
  width: 100%;
  height: 720px;
  border-radius: 10px;
  overflow: hidden;
}
.analysis-page {
  padding: 20px;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  min-height: 100vh;
}
.filter-bar {
  margin-bottom: 14px;
  padding: 16px 20px;
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}
.filter-title {
  width: 100%;
  margin: 0 0 10px 0;
  font-size: 15px;
  color: #303133;
  font-weight: 600;
}
.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.status-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.filter-bar select,
.filter-bar input,
.filter-bar button {
  min-width: 160px;
  height: 40px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.filter-bar select:focus,
.filter-bar input:focus {
  border-color: #409eff;
}
.filter-bar select {
  max-height: 200px;
  overflow-y: auto;
}
.filter-bar button {
  background-color: #409eff;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
  border: none;
  font-weight: 500;
}
.filter-bar button:hover {
  background-color: #337ecc;
}
.filter-bar button:disabled {
  background: #a0cfff;
  cursor: not-allowed;
}
.filter-bar .play-btn {
  background-color: #67c23a;
}
.filter-bar .play-btn:hover {
  background-color: #5daf34;
}
.filter-bar .play-btn:disabled {
  background: #95d475;
}
.hint-text {
  font-size: 13px;
  color: #909399;
}
.loading-tip {
  color: #409eff;
  font-size: 13px;
}
.empty-tip {
  color: #e64a19;
  font-size: 13px;
}
.stats-text {
  color: #606266;
  font-size: 13px;
}
.stats-text b {
  color: #303133;
}
</style>
