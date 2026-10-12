import { io } from "socket.io-client";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let token = localStorage.getItem("token") || "";
export const setToken = (t) => {
  token = t || "";
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
};

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const e = new Error("network");
    e.network = true;
    throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    const e = new Error(msg || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

export const createSocket = () => io(API_URL, { transports: ["websocket", "polling"] });
