import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BiSearch } from "react-icons/bi";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import Avatar from "./Avatar";

export default function ContactsView({ onLogin }) {
  const { t, user, openDirect, showToast } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState([]);

  useEffect(() => {
    if (!user) return;
    const id = setTimeout(() => {
      api(`/users?q=${encodeURIComponent(q)}`).then(setPeople).catch(() => setPeople([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q, user]);

  if (!user)
    return (
      <div className="note pad">
        <p>{t("loginForContacts")}</p>
        <button className="pill" onClick={onLogin}>{t("login")}</button>
      </div>
    );

  const open = async (name) => {
    try { const r = await openDirect(name); nav(`/r/${r.slug}`); }
    catch (e) { showToast(e.message); }
  };

  return (
    <>
      <div className="search always">
        <BiSearch />
        <input placeholder={t("searchPeople")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chat-list">
        {people.length === 0 && <div className="note">{t("nobody")}</div>}
        {people.map((p) => (
          <button key={p.username} className="chat-item" onClick={() => open(p.username)}>
            <Avatar name={p.username} size={48} />
            <div className="chat-item-body"><b>{p.username}</b><span className="preview">{t("message")}</span></div>
          </button>
        ))}
      </div>
    </>
  );
}
