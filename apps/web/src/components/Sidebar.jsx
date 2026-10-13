import { useState } from "react";
import { NavLink } from "react-router-dom";
import { BiSearch, BiX, BiPencil, BiMessageRounded, BiUserCircle, BiCog, BiGroup } from "react-icons/bi";
import dayjs from "dayjs";
import { useApp } from "../context/AppContext";
import Avatar from "./Avatar";
import AuthModal from "./AuthModal";
import RoomModal from "./RoomModal";
import ContactsView from "./ContactsView";
import SettingsView from "./SettingsView";
import ProfileView from "./ProfileView";

const preview = (m, t) => (m.hasImage ? `📷 ${m.text || t("photo")}` : m.text);

export default function Sidebar() {
  const { t, rooms, unread, loading, error, load, user, username, connected } = useApp();
  const [tab, setTab] = useState("chats");
  const [folder, setFolder] = useState("all");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [modal, setModal] = useState(null); // "auth" | "room"

  const unreadOf = (kind) =>
    rooms.filter((r) => !kind || r.kind === kind).reduce((n, r) => n + (unread[r.slug] || 0), 0);
  const list = rooms
    .filter((r) => folder === "all" || (folder === "rooms" ? r.kind === "PUBLIC" : r.kind === "DIRECT"))
    .filter((r) => r.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => +new Date(b.lastMessage?.createdAt || 0) - +new Date(a.lastMessage?.createdAt || 0));

  const titles = { chats: t("appName"), contacts: t("contacts"), settings: t("settings"), profile: t("profile") };
  const folders = [["all", t("all")], ["rooms", t("rooms")], ["direct", t("direct")]];
  const nav = [
    ["chats", t("chats"), BiMessageRounded, unreadOf()],
    ["contacts", t("contacts"), BiGroup, 0],
    ["settings", t("settings"), BiCog, 0],
    ["profile", t("profile"), BiUserCircle, 0],
  ];

  return (
    <aside className="sidebar">
      <header className="top">
        <div className="top-left" onClick={() => setTab("profile")}>
          <Avatar name={username} size={38} />
          <h1>{titles[tab]}</h1>
        </div>
        {tab === "chats" && (
          <button className="icon-btn" aria-label={t("search")} onClick={() => { setSearching(!searching); setQ(""); }}>
            {searching ? <BiX /> : <BiSearch />}
          </button>
        )}
      </header>

      {tab === "chats" && (
        <>
          {searching && (
            <div className="search">
              <BiSearch />
              <input autoFocus placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <div className="folders" role="tablist">
            {folders.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={folder === k} className={folder === k ? "on" : ""} onClick={() => setFolder(k)}>
                {label}
                {unreadOf(k === "rooms" ? "PUBLIC" : k === "direct" ? "DIRECT" : null) > 0 && k !== "all" && (
                  <span className="count">{unreadOf(k === "rooms" ? "PUBLIC" : "DIRECT")}</span>
                )}
              </button>
            ))}
          </div>
          <div className="chat-list">
            {loading && <div className="note">{t("connecting")}</div>}
            {error && (
              <div className="note error">
                {error}
                <button className="pill" onClick={() => load()}>{t("retry")}</button>
              </div>
            )}
            {list.map((r) => (
              <NavLink key={r.slug} to={`/r/${r.slug}`} className="chat-item">
                <Avatar name={r.title} size={54} />
                <div className="chat-item-body">
                  <div className="row">
                    <b className="truncate">{r.title}</b>
                    {r.lastMessage && <small>{dayjs(r.lastMessage.createdAt).format("HH:mm")}</small>}
                  </div>
                  <div className="row">
                    <span className="truncate preview">
                      {r.lastMessage ? `${r.lastMessage.username === username ? t("you") : r.lastMessage.username}: ${preview(r.lastMessage, t)}` : r.kind === "DIRECT" ? t("openChat") : t("members")}
                    </span>
                    {unread[r.slug] > 0 && <span className="badge">{unread[r.slug]}</span>}
                  </div>
                </div>
              </NavLink>
            ))}
          </div>
          <button className="fab" aria-label={t("newRoom")} onClick={() => setModal(user ? "room" : "auth")}>
            <BiPencil />
          </button>
        </>
      )}
      {tab === "contacts" && <ContactsView onLogin={() => setModal("auth")} />}
      {tab === "settings" && <SettingsView />}
      {tab === "profile" && <ProfileView onLogin={() => setModal("auth")} />}

      {!connected && !error && !loading && <div className="conn">{t("connecting")}</div>}
      <nav className="bottom-nav">
        {nav.map(([k, label, Icon, n]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} aria-label={label}>
            <span className="ico"><Icon />{n > 0 && <i className="badge small">{n}</i>}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {modal === "auth" && <AuthModal onClose={() => setModal(null)} />}
      {modal === "room" && <RoomModal onClose={() => setModal(null)} />}
    </aside>
  );
}
