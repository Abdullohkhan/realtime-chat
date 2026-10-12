import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, createSocket, setToken, shrinkImage, uploadImage } from "../api";
import { dict } from "../i18n";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const randomName = () => `user${Date.now().toString().slice(-4)}`;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export function AppProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem("lang") || "uz");
  const [theme, setThemeState] = useState(localStorage.getItem("theme") || "dark");
  const [user, setUser] = useState(read("user"));
  const [guestName, setGuestNameState] = useState(localStorage.getItem("guestName") || randomName());
  const [country, setCountry] = useState(localStorage.getItem("countryCode") || "");
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState({}); // slug -> [msg]
  const [hasMore, setHasMore] = useState({});
  const [unread, setUnread] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(0);
  const [typing, setTyping] = useState({}); // slug -> { name: timeoutId }
  const active = useRef(null);
  const roomsRef = useRef([]);
  const socketRef = useRef(null);
  const lastTyping = useRef(0);

  const t = useCallback((k) => dict[lang][k] ?? k, [lang]);
  const setLang = (l) => { localStorage.setItem("lang", l); setLangState(l); };
  const setTheme = (v) => { localStorage.setItem("theme", v); setThemeState(v); };
  const setGuestName = (n) => { localStorage.setItem("guestName", n); setGuestNameState(n); };
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 4000); };
  const username = user ? user.username : guestName;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#17212b" : "#ffffff");
  }, [theme, lang]);
  useEffect(() => { localStorage.setItem("guestName", guestName); }, [guestName]);

  const setRoomList = (rs) => { roomsRef.current = rs; setRooms(rs); };

  const bump = useCallback((m) => {
    setRooms((rs) => {
      const next = rs.map((r) => (r.slug === m.room ? { ...r, lastMessage: m } : r));
      roomsRef.current = next;
      return next;
    });
  }, []);

  const addMessage = useCallback((slug, m) => {
    setMessages((prev) => {
      const list = prev[slug] || [];
      if (list.some((x) => x.id === m.id)) return prev;
      return { ...prev, [slug]: [...list, m] };
    });
    bump({ ...m, room: slug, hasImage: !!m.imageUrl });
  }, [bump]);

  const load = useCallback(async (silent) => {
    if (!silent) { setError(""); setLoading(true); }
    try {
      const rs = await api("/rooms");
      setRoomList(rs);
      if (socketRef.current?.connected) rs.forEach((r) => socketRef.current.emit("join", r.slug));
    } catch (e) {
      if (!silent) setError(e.network ? t("serverDown") : e.message);
    } finally { if (!silent) setLoading(false); }
  }, [t]);

  const openRoom = useCallback(async (slug) => {
    active.current = slug;
    setUnread((u) => ({ ...u, [slug]: 0 }));
    if (messages[slug]) return;
    try {
      const list = await api(`/rooms/${slug}/messages?limit=50`);
      setMessages((p) => ({ ...p, [slug]: list }));
      setHasMore((p) => ({ ...p, [slug]: list.length === 50 }));
    } catch (e) { showToast(e.network ? t("serverDown") : e.message); }
  }, [messages, t]);

  const loadOlder = async (slug) => {
    const list = messages[slug] || [];
    if (!list.length || !hasMore[slug]) return 0;
    const older = await api(`/rooms/${slug}/messages?limit=50&before=${list[0].id}`);
    setMessages((p) => ({ ...p, [slug]: [...older, ...(p[slug] || [])] }));
    setHasMore((p) => ({ ...p, [slug]: older.length === 50 }));
    return older.length;
  };

  const send = async (slug, { text, imageId, replyToId }) => {
    try {
      const m = await api(`/rooms/${slug}/messages`, {
        method: "POST",
        body: { text, imageId, replyToId, country: country || undefined, ...(user ? {} : { guestName }) },
      });
      addMessage(slug, m);
      return true;
    } catch (e) {
      showToast(e.network ? t("serverDown") : e.message);
      return false;
    }
  };

  const sendImage = async (file) => {
    if (!user) { showToast(t("loginFor")); return null; }
    try {
      const blob = await shrinkImage(file);
      const { id } = await uploadImage(blob);
      return { id, preview: URL.createObjectURL(blob) };
    } catch (e) {
      showToast(e.network ? t("serverDown") : e.message);
      return null;
    }
  };

  const react = async (slug, id, emoji) => {
    if (!user) { showToast(t("loginFor")); return; }
    try {
      const { reactions } = await api(`/rooms/${slug}/messages/${id}/reactions`, { method: "POST", body: { emoji } });
      setMessages((p) => ({ ...p, [slug]: (p[slug] || []).map((m) => (m.id === id ? { ...m, reactions } : m)) }));
    } catch (e) { showToast(e.message); }
  };

  const removeMessage = async (slug, id) => {
    try { await api(`/rooms/${slug}/messages/${id}`, { method: "DELETE" }); }
    catch (e) { showToast(e.message); }
  };

  const notifyTyping = (slug) => {
    const now = Date.now();
    if (now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    socketRef.current?.emit("typing", { slug, name: username });
  };

  const resetSession = () => { setMessages({}); setHasMore({}); setUnread({}); };
  const auth = async (path, body) => {
    const res = await api(`/auth/${path}`, { method: "POST", body });
    setToken(res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    resetSession();
    setUser(res.user);
    return res;
  };
  const logout = () => {
    setToken(""); localStorage.removeItem("user"); resetSession(); setUser(null);
  };

  const createRoom = async (slug, title) => {
    const r = await api("/rooms", { method: "POST", body: { slug, title } });
    setRoomList([...roomsRef.current, r]);
    socketRef.current?.emit("join", r.slug);
    return r;
  };
  const openDirect = async (name) => {
    const r = await api("/dm", { method: "POST", body: { username: name } });
    if (!roomsRef.current.some((x) => x.slug === r.slug)) setRoomList([...roomsRef.current, r]);
    return r;
  };

  // Socket: kirish/chiqishda qayta ulanadi (token almashadi)
  useEffect(() => {
    const s = createSocket();
    socketRef.current = s;
    s.on("connect", () => { setConnected(true); roomsRef.current.forEach((r) => s.emit("join", r.slug)); });
    s.on("disconnect", () => setConnected(false));
    s.on("online", setOnline);
    s.on("message", (m) => {
      if (!roomsRef.current.some((r) => r.slug === m.room)) load(true); // yangi shaxsiy chat
      addMessage(m.room, m);
      if (m.room !== active.current || document.hidden)
        setUnread((u) => ({ ...u, [m.room]: (u[m.room] || 0) + 1 }));
    });
    s.on("deleted", ({ id, room }) => {
      setMessages((p) => ({
        ...p,
        [room]: (p[room] || []).filter((m) => m.id !== id).map((m) => (m.replyTo?.id === id ? { ...m, replyTo: null } : m)),
      }));
    });
    s.on("reactions", ({ room, id, reactions }) => {
      setMessages((p) => ({ ...p, [room]: (p[room] || []).map((m) => (m.id === id ? { ...m, reactions } : m)) }));
    });
    s.on("typing", ({ room, name }) => {
      setTyping((p) => {
        clearTimeout(p[room]?.[name]);
        const id = setTimeout(() => setTyping((q) => {
          const { [name]: _, ...rest } = q[room] || {};
          return { ...q, [room]: rest };
        }), 3000);
        return { ...p, [room]: { ...(p[room] || {}), [name]: id } };
      });
    });
    return () => s.close();
  }, [addMessage, user?.id]); // eslint-disable-line

  useEffect(() => { load(); }, [user?.id]); // eslint-disable-line
  useEffect(() => {
    if (country) return;
    fetch("https://api.db-ip.com/v2/free/self")
      .then((r) => r.json())
      .then(({ countryCode }) => {
        if (countryCode?.length === 2) { setCountry(countryCode); localStorage.setItem("countryCode", countryCode); }
      })
      .catch(() => {});
  }, []); // eslint-disable-line

  return (
    <Ctx.Provider value={{
      t, lang, setLang, theme, setTheme, user, username, guestName, setGuestName, country, rooms, messages, hasMore,
      unread, loading, error, connected, toast, showToast, load, openRoom, loadOlder, send, sendImage, react,
      auth, logout, createRoom, openDirect, online, typing, removeMessage, notifyTyping,
    }}>
      {children}
    </Ctx.Provider>
  );
}
