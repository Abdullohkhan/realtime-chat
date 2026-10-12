import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, createSocket, setToken } from "../api";
import { dict } from "../i18n";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const randomName = () => `user${Date.now().toString().slice(-4)}`;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

export function AppProvider({ children }) {
  const [lang, setLangState] = useState(localStorage.getItem("lang") || "uz");
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

  const t = useCallback((k) => dict[lang][k] ?? k, [lang]);
  const setLang = (l) => { localStorage.setItem("lang", l); setLangState(l); };
  const setGuestName = (n) => { localStorage.setItem("guestName", n); setGuestNameState(n); };
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 4000); };
  const username = user ? user.username : guestName;

  useEffect(() => { localStorage.setItem("guestName", guestName); }, [guestName]);

  const bump = useCallback((m) => {
    setRooms((rs) => rs.map((r) => (r.slug === m.room ? { ...r, lastMessage: m } : r)));
  }, []);

  const addMessage = useCallback((slug, m) => {
    setMessages((prev) => {
      const list = prev[slug] || [];
      if (list.some((x) => x.id === m.id)) return prev;
      return { ...prev, [slug]: [...list, m] };
    });
    bump({ ...m, room: slug });
  }, [bump]);

  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try {
      const rs = await api("/rooms");
      setRooms(rs); roomsRef.current = rs;
      socketRef.current?.connected && rs.forEach((r) => socketRef.current.emit("join", r.slug));
    } catch (e) {
      setError(e.network ? t("serverDown") : e.message);
    } finally { setLoading(false); }
  }, [t]);

  const openRoom = useCallback(async (slug) => {
    active.current = slug;
    setUnread((u) => ({ ...u, [slug]: 0 }));
    if (messages[slug]) return;
    try {
      const list = await api(`/rooms/${slug}/messages?limit=50`);
      setMessages((p) => ({ ...p, [slug]: list }));
      setHasMore((p) => ({ ...p, [slug]: list.length === 50 }));
    } catch (e) { showToast(e.message); }
  }, [messages]);

  const loadOlder = async (slug) => {
    const list = messages[slug] || [];
    if (!list.length || !hasMore[slug]) return 0;
    const older = await api(`/rooms/${slug}/messages?limit=50&before=${list[0].id}`);
    setMessages((p) => ({ ...p, [slug]: [...older, ...(p[slug] || [])] }));
    setHasMore((p) => ({ ...p, [slug]: older.length === 50 }));
    return older.length;
  };

  const send = async (slug, text, replyToId) => {
    try {
      const m = await api(`/rooms/${slug}/messages`, {
        method: "POST",
        body: { text, replyToId, country: country || undefined, ...(user ? {} : { guestName }) },
      });
      addMessage(slug, m);
      return true;
    } catch (e) {
      showToast(e.network ? t("serverDown") : e.message);
      return false;
    }
  };

  const removeMessage = async (slug, id) => {
    try { await api(`/rooms/${slug}/messages/${id}`, { method: "DELETE" }); }
    catch (e) { showToast(e.message); }
  };

  const lastTyping = useRef(0);
  const notifyTyping = (slug) => {
    const now = Date.now();
    if (now - lastTyping.current < 2000) return;
    lastTyping.current = now;
    socketRef.current?.emit("typing", { slug, name: username });
  };

  const auth = async (mode, body) => {
    const res = await api(`/auth/${mode}`, { method: "POST", body });
    setToken(res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
  };
  const logout = () => {
    setToken(""); localStorage.removeItem("user"); setUser(null);
  };
  const createRoom = async (slug, title) => {
    const r = await api("/rooms", { method: "POST", body: { slug, title } });
    const withLast = { ...r, lastMessage: null };
    setRooms((rs) => { roomsRef.current = [...rs, withLast]; return [...rs, withLast]; });
    socketRef.current?.emit("join", r.slug);
    return r;
  };

  // Socket: bir marta ulanadi, qayta ulanganda xonalarga qaytadan qo'shiladi
  useEffect(() => {
    const s = createSocket();
    socketRef.current = s;
    s.on("connect", () => { setConnected(true); roomsRef.current.forEach((r) => s.emit("join", r.slug)); });
    s.on("disconnect", () => setConnected(false));
    s.on("online", setOnline);
    s.on("deleted", ({ id, room }) => {
      setMessages((p) => ({
        ...p,
        [room]: (p[room] || [])
          .filter((m) => m.id !== id)
          .map((m) => (m.replyTo?.id === id ? { ...m, replyTo: null } : m)),
      }));
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
    s.on("message", (m) => {
      addMessage(m.room, m);
      if (m.room !== active.current || document.hidden)
        setUnread((u) => ({ ...u, [m.room]: (u[m.room] || 0) + 1 }));
    });
    return () => s.close();
  }, [addMessage]);

  useEffect(() => {
    load();
    if (!country) {
      fetch("https://api.db-ip.com/v2/free/self")
        .then((r) => r.json())
        .then(({ countryCode }) => {
          if (countryCode?.length === 2) { setCountry(countryCode); localStorage.setItem("countryCode", countryCode); }
        })
        .catch(() => {});
    }
  }, []); // eslint-disable-line

  return (
    <Ctx.Provider value={{
      t, lang, setLang, user, username, guestName, setGuestName, country, rooms, messages, hasMore,
      unread, loading, error, connected, toast, showToast, load, openRoom, loadOlder, send,
      auth, logout, createRoom, online, typing, removeMessage, notifyTyping,
    }}>
      {children}
    </Ctx.Provider>
  );
}
