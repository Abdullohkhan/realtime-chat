const COLORS = ["#e17076", "#7bc862", "#e5ca77", "#65aadd", "#a695e7", "#ee7aae", "#6ec9cb", "#faa774"];
export function colorFor(s = "") {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}
export default function Avatar({ name, size = 48 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.42 }}>
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}
