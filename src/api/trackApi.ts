import request from "../utils/request";

// 车牌筛选
export const getTrackByCar = (carNo: string) =>
  request.get("/byCar", { params: { carNo } });
// 时间筛选
export const getTrackByTime = (start: string, end: string) =>
  request.get("/byTime", { params: { start, end } });
// 矩形空间筛选（可选传入 carNo 实现联合过滤）
export const getTrackByBbox = (
  minLng: string,
  maxLng: string,
  minLat: string,
  maxLat: string,
  carNo?: string,
) => {
  const params: Record<string, string> = { minLng, maxLng, minLat, maxLat };
  if (carNo) params.carNo = carNo;
  return request.get("/byBbox", { params });
};
// 获取全部车牌下拉选项
export const getCarList = () => request.get("/distinctCarList");

// 组合筛选接口（支持获取全部轨迹）
export const getTrackByAdvanced = (params?: {
  carNo?: string;
  start?: string;
  end?: string;
  minLng?: number;
  maxLng?: number;
  minLat?: number;
  maxLat?: number;
  speedMin?: number;
  speedMax?: number;
  limit?: number;
}) => request.get("/byAdvanced", { params });
