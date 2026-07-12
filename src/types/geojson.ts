// 经纬度坐标类型 WGS84 [经度,纬度]
export type LngLat = [number, number];

// 单个点位要素类型
export interface PointFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: LngLat;
  };
  properties: {
    id: number;
    name: string;
  };
}

// 线要素轨迹类型
export interface LineFeature {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: LngLat[];
  };
  properties: {
    carNo: string;
  };
}

// 要素集合统一类型
export type GeoFeature = PointFeature | LineFeature;

export interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}
