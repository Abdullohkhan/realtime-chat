import { useState } from "react";
import { NavLink } from "react-router-dom";
import { BiEdit, BiPlus, BiLogOut } from "react-icons/bi";
import dayjs from "dayjs";
import { useApp } from "../context/AppContext";
import Avatar from "./Avatar";
import AuthModal from "./AuthModal";
import RoomModal from "./RoomModal";
import NameModal from "./NameModal";

export default function Sidebar() {
  const { t, rooms, unread, loading, error, load, user, username, logout, lang, setLang, connected } = useApp();
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // "auth" | "room" | "name"
  const list = rooms.filter((r) => r.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <div className="me" onClick={() => (user ? null : setModal("auth"))}>
          <Avatar name={username} size={40} />
          <div className="me-text">
            <b>{username}</b>
            <small>{user ? t("online") : t("guestAs")}</small>
          </div>
        </div>
        <div className="head-actions">
          <button className="lang" onClick={() => setLang(lang === "uz" ? "en" : "uz")}>{lang.toUpperCase()}</button>
          {!user && <button className="icon-btn" title={t("changeName")} onClick={() => setModal("name")}><BiEdit /></button>}
          {user ? (
            <button className="icon-btn" title={t("logout")} onClick={logout}><BiLogOut /></button>
          ) : (
            <button className="pill" onClick={() => setModal("auth")}>{t("login")}</button>
          )}
        </div>
      </header>
      <div className="search">
        <input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chat-list">
        {loading && <div className="note">{t("connecting")}</div>}
        {error && (
          <div className="note error">
            {error}
            <button className="pill" onClick={load}>{t("retry")}</button>
          </div>
        )}
        {list.map((r) => (
          <NavLink key={r.slug} to={`/r/${r.slug}`} className="chat-item">
            <Avatar name={r.title} />
            <div className="chat-item-body">
              <div className="row">
                <b className="truncate">{r.title}</b>
                {r.lastMessage && <small>{dayjs(r.lastMessage.createdAt).format("HH:mm")}</small>}
              </div>
              <div className="row">
                <span className="truncate preview">
                  {r.lastMessage ? `${r.lastMessage.username}: ${r.lastMessage.text}` : t("members")}
                </span>
                {unread[r.slug] > 0 && <span className="badge">{unread[r.slug]}</span>}
              </div>
            </div>
          </NavLink>
        ))}
      </div>
      <button
        className="fab"
        title={t("newRoom")}
        onClick={() => (user ? setModal("room") : setModal("auth"))}
      >
        <BiPlus />
      </button>
      {!connected && !error && !loading && <div className="conn">{t("connecting")}</div>}
      {modal === "auth" && <AuthModal onClose={() => setModal(null)} />}
      {modal === "room" && <RoomModal onClose={() => setModal(null)} />}
      {modal === "name" && <NameModal onClose={() => setModal(null)} />}
    </aside>
  );
}
