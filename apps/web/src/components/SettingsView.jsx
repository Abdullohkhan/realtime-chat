import { useApp } from "../context/AppContext";

export default function SettingsView() {
  const { t, lang, setLang, theme, setTheme } = useApp();
  const seg = (value, set, items) => (
    <div className="seg">
      {items.map(([k, label]) => (
        <button key={k} className={value === k ? "on" : ""} onClick={() => set(k)}>{label}</button>
      ))}
    </div>
  );
  return (
    <div className="panel">
      <div className="setting"><span>{t("language")}</span>{seg(lang, setLang, [["uz", "O'zbekcha"], ["en", "English"]])}</div>
      <div className="setting"><span>{t("theme")}</span>{seg(theme, setTheme, [["dark", t("dark")], ["light", t("light")]])}</div>
      <div className="setting about">
        <span>{t("about")}</span>
        <small>Suhbat · NestJS + React · Apache-2.0<br />Asl muallif: Shimon Wosner</small>
      </div>
    </div>
  );
}
