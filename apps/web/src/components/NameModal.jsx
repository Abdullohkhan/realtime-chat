import { useState } from "react";
import { useApp } from "../context/AppContext";
import Modal from "./Modal";

export default function NameModal({ onClose }) {
  const { t, guestName, setGuestName } = useApp();
  const [v, setV] = useState(guestName);
  const ok = /^[a-zA-Z0-9_]{1,15}$/.test(v);
  return (
    <Modal title={t("changeName")} onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); if (ok) { setGuestName(v); onClose(); } }}>
        <input value={v} onChange={(e) => setV(e.target.value)} maxLength={15} autoFocus />
        <button className="primary" disabled={!ok}>{t("save")}</button>
      </form>
    </Modal>
  );
}
