import axios from "axios";

/**
 * Single axios instance every API call goes through.
 *
 * Base URL comes from REACT_APP_API_URL (see .env). Trailing slashes are
 * stripped so `/api/students` can never become `//api/students`.
 */
export const API_BASE_URL = String(process.env.REACT_APP_API_URL || "http://localhost:8080").replace(/\/+$/, "");

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 20000,
});

/* Attach the session token when the backend starts handing one out. Until real
   auth exists `ntti.auth` has no token, so this is simply a no-op. */
client.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(window.localStorage.getItem("ntti.auth") || "null");
    if (session && session.token) {
      config.headers.Authorization = `Bearer ${session.token}`;
    }
  } catch {
    /* ignore malformed session */
  }
  return config;
});

/* Normalise errors so callers get `error.status` and `error.apiMessage`
   regardless of whether the request failed at the network or HTTP layer. */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    error.status = error.response ? error.response.status : 0;
    error.apiMessage =
      (error.response && error.response.data && (error.response.data.message || error.response.data.error)) ||
      error.message ||
      "Request failed";
    return Promise.reject(error);
  }
);

export default client;
