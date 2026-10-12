import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import Modal from "./Modal";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

export default function RoomModal({ onClose }) {
  const { t, createRoom } = useApp();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await createRoom(slug || slugify(title), title);
      onClose();
      nav(`/r/${r.slug}`);
    } catch (e) { setErr(e.message); }
  };

  return (
    <Modal title={t("newRoom")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <input placeholder={t("roomTitle")} value={title} maxLength={40} required autoFocus
          onChange={(e) => { setTitle(e.target.value); setSlug(slugify(e.target.value)); }} />
        <input placeholder={t("roomSlug")} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} required />
        {err && <div className="form-error">{err}</div>}
        <button className="primary">{t("create")}</button>
      </form>
    </Modal>
  );
}
