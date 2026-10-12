import { useEffect, useState } from "react";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import Modal from "./Modal";

export default function AuthModal({ onClose }) {
  const { t, auth } = useApp();
  const [method, setMethod] = useState("phone");
  const [mode, setMode] = useState("login"); // email: login | register
  const [step, setStep] = useState("phone"); // phone: phone | code
  const [f, setF] = useState({ email: "", username: "", password: "", phone: "+998", code: "" });
  const [wait, setWait] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const run = async (fn) => {
    setBusy(true); setErr("");
    try { await fn(); }
    catch (e) { setErr(e.network ? t("serverDown") : e.message); }
    finally { setBusy(false); }
  };

  const sendCode = (e) => {
    e?.preventDefault();
    return run(async () => {
      await api("/auth/phone/request", { method: "POST", body: { phone: f.phone } });
      setStep("code"); setWait(45);
    });
  };
  const verify = (e) => {
    e.preventDefault();
    return run(async () => {
      await auth("phone/verify", { phone: f.phone, code: f.code, ...(f.username ? { username: f.username } : {}) });
      onClose();
    });
  };
  const emailSubmit = (e) => {
    e.preventDefault();
    return run(async () => {
      await auth(mode, mode === "login" ? { email: f.email, password: f.password } : { email: f.email, username: f.username, password: f.password });
      onClose();
    });
  };

  return (
    <Modal title={t("login")} onClose={onClose}>
      <div className="seg">
        <button className={method === "phone" ? "on" : ""} onClick={() => { setMethod("phone"); setErr(""); }}>{t("byPhone")}</button>
        <button className={method === "email" ? "on" : ""} onClick={() => { setMethod("email"); setErr(""); }}>{t("byEmail")}</button>
      </div>
      {method === "phone" && step === "phone" && (
        <form onSubmit={sendCode} className="form">
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder={t("phone")} value={f.phone} onChange={set("phone")} required autoFocus />
          {err && <div className="form-error">{err}</div>}
          <button className="primary" disabled={busy}>{t("sendCode")}</button>
        </form>
      )}
      {method === "phone" && step === "code" && (
        <form onSubmit={verify} className="form">
          <small className="muted">{t("codeSent")}</small>
          <input inputMode="numeric" autoComplete="one-time-code" placeholder={t("code")} value={f.code}
            onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 6) })} required autoFocus maxLength={6} />
          <input placeholder={t("pickUsername")} value={f.username} onChange={set("username")} maxLength={15} />
          {err && <div className="form-error">{err}</div>}
          <button className="primary" disabled={busy || f.code.length !== 6}>{t("verify")}</button>
          <div className="row">
            <button type="button" className="link" onClick={() => { setStep("phone"); setErr(""); }}>{t("changePhone")}</button>
            <button type="button" className="link" disabled={wait > 0 || busy} onClick={sendCode}>
              {t("resendIn")}{wait > 0 ? ` (${wait})` : ""}
            </button>
          </div>
        </form>
      )}
      {method === "email" && (
        <form onSubmit={emailSubmit} className="form">
          <input type="email" placeholder={t("email")} value={f.email} onChange={set("email")} required />
          {mode === "register" && <input placeholder={t("username")} value={f.username} onChange={set("username")} required maxLength={15} />}
          <input type="password" placeholder={t("password")} value={f.password} onChange={set("password")} required minLength={6} />
          {err && <div className="form-error">{err}</div>}
          <button className="primary" disabled={busy}>{mode === "login" ? t("login") : t("register")}</button>
          <button type="button" className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? t("noAccount") : t("haveAccount")}
          </button>
        </form>
      )}
    </Modal>
  );
}
