import { useState } from "react";
import { useApp } from "../context/AppContext";
import Modal from "./Modal";

export default function AuthModal({ onClose }) {
  const { t, auth } = useApp();
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ email: "", username: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await auth(mode, mode === "login" ? { email: f.email, password: f.password } : f);
      onClose();
    } catch (e) {
      setErr(e.network ? t("serverDown") : e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal title={mode === "login" ? t("login") : t("register")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <input type="email" placeholder={t("email")} value={f.email} onChange={set("email")} required autoFocus />
        {mode === "register" && (
          <input placeholder={t("username")} value={f.username} onChange={set("username")} required maxLength={15} />
        )}
        <input type="password" placeholder={t("password")} value={f.password} onChange={set("password")} required minLength={6} />
        {err && <div className="form-error">{err}</div>}
        <button className="primary" disabled={busy}>{mode === "login" ? t("login") : t("register")}</button>
        <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? t("noAccount") : t("haveAccount")}
        </button>
      </form>
    </Modal>
  );
}
