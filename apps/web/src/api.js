import { io } from "socket.io-client";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

let token = localStorage.getItem("token") || "";
export const getToken = () => token;
export const setToken = (t) => {
  token = t || "";
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
};

const fail = async (res) => {
  const data = await res.json().catch(() => ({}));
  const msg = Array.isArray(data.message) ? data.message[0] : data.message;
  const e = new Error(msg || `HTTP ${res.status}`);
  e.status = res.status;
  return e;
};

const net = () => Object.assign(new Error("network"), { network: true });

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
    throw net();
  }
  if (!res.ok) throw await fail(res);
  return res.json().catch(() => ({}));
}

export async function uploadImage(blob) {
  const form = new FormData();
  form.append("file", blob, "image");
  let res;
  try {
    res = await fetch(`${API_URL}/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
  } catch {
    throw net();
  }
  if (!res.ok) throw await fail(res);
  return res.json();
}

export const createSocket = () =>
  io(API_URL, { transports: ["websocket", "polling"], auth: { token } });

/** Katta rasmni telefonda kichraytiradi (1280px, JPEG). GIF o'zgarishsiz qoladi. */
export async function shrinkImage(file) {
  if (file.type === "image/gif" || file.size < 250 * 1024) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
  return blob && blob.size < file.size ? blob : file;
}
