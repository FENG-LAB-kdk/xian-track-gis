import axios from "axios";

const baseURL = `${import.meta.env.VITE_API_URL}/api/track`;
const request = axios.create({
  baseURL,
  timeout: 15000,
});
// 请求拦截器：无需手动标注回调参数类型，axios会自动完成类型推导
request.interceptors.request.use(
  (config) => {
    return config;
  },
  (err) => Promise.reject(err),
);

// 响应拦截器
request.interceptors.response.use(
  (resp) => {
    return resp.data;
  },
  (err) => Promise.reject(err),
);

export default request;
