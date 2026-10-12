import { useState } from "react";
import { useApp } from "../context/AppContext";
import Avatar from "./Avatar";

export default function ProfileView({ onLogin }) {
  const { t, user, username, guestName, setGuestName, logout } = useApp();
  const [v, setV] = useState(guestName);
  const ok = /^[a-zA-Z0-9_]{1,15}$/.test(v);
  return (
    <div className="panel center">
      <Avatar name={username} size={96} />
      <h2>{username}</h2>
      {user ? (
        <>
          <small className="muted">{t("online")}</small>
          <button className="primary wide" onClick={logout}>{t("logout")}</button>
        </>
      ) : (
        <>
          <small className="muted">{t("guestHint")}</small>
          <form className="form wide" onSubmit={(e) => { e.preventDefault(); if (ok) setGuestName(v); }}>
            <input value={v} onChange={(e) => setV(e.target.value)} maxLength={15} aria-label={t("changeName")} />
            <button className="ghost" disabled={!ok || v === guestName}>{t("save")}</button>
          </form>
          <button className="primary wide" onClick={onLogin}>{t("login")}</button>
        </>
      )}
    </div>
  );
}
