import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BiArrowBack, BiSend } from "react-icons/bi";
import { MdVerified } from "react-icons/md";
import dayjs from "dayjs";
import { useApp } from "../context/AppContext";
import Avatar, { colorFor } from "./Avatar";

function dayLabel(d, t) {
  const m = dayjs(d);
  if (m.isSame(dayjs(), "day")) return t("today");
  if (m.isSame(dayjs().subtract(1, "day"), "day")) return t("yesterday");
  return m.format("D MMM YYYY");
}

export default function ChatView() {
  const { slug } = useParams();
  const { t, rooms, messages, username, openRoom, loadOlder, send, connected } = useApp();
  const room = rooms.find((r) => r.slug === slug);
  const list = messages[slug] || [];
  const [text, setText] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [fresh, setFresh] = useState(0);
  const box = useRef();
  const prevLen = useRef(0);
  const prevHeight = useRef(null);
  const lastId = useRef(null);

  useEffect(() => { openRoom(slug); }, [slug]); // eslint-disable-line
  useEffect(() => { prevLen.current = 0; lastId.current = null; setFresh(0); }, [slug]);

  // Skroll: o'z xabarim yoki pastda bo'lsam -> pastga; eski xabarlar yuklansa joyni saqlash
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || !list.length) return;
    if (prevHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else {
      const last = list[list.length - 1];
      const isNew = lastId.current !== null && last.id !== lastId.current;
      if (lastId.current === null || last.username === username || atBottom) el.scrollTop = el.scrollHeight;
      else if (isNew) setFresh((n) => n + 1);
      lastId.current = last.id;
    }
    prevLen.current = list.length;
  }, [list, slug]); // eslint-disable-line

  const onScroll = async (e) => {
    const el = e.currentTarget;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(bottom);
    if (bottom) setFresh(0);
    if (el.scrollTop < 40 && list.length) {
      prevHeight.current = el.scrollHeight;
      const n = await loadOlder(slug);
      if (!n) prevHeight.current = null;
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    if (!(await send(slug, v))) setText(v);
  };

  if (!room) return <div className="empty-main">…</div>;

  let lastDay = "";
  return (
    <section className="chat">
      <header className="chat-head">
        <Link to="/" className="back" aria-label={t("back")}><BiArrowBack /></Link>
        <Avatar name={room.title} size={40} />
        <div>
          <b>{room.title}</b>
          <small>{connected ? t("members") : t("connecting")}</small>
        </div>
      </header>
      <div className="messages" ref={box} onScroll={onScroll}>
        {!list.length && <div className="note center">{t("noMessages")}</div>}
        {list.map((m, i) => {
          const day = dayjs(m.createdAt).format("YYYY-MM-DD");
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.username === username;
          const prev = list[i - 1];
          const first = !prev || prev.username !== m.username || showDay;
          return (
            <div key={m.id}>
              {showDay && <div className="day"><span>{dayLabel(m.createdAt, t)}</span></div>}
              <div className={`row-msg ${mine ? "mine" : ""}`}>
                {!mine && (first ? <Avatar name={m.username} size={34} /> : <div style={{ width: 34 }} />)}
                <div className={`bubble ${mine ? "mine" : ""} ${first ? "first" : ""}`}>
                  {!mine && first && (
                    <div className="author" style={{ color: colorFor(m.username) }}>
                      {m.username}
                      {m.isAuthenticated && <MdVerified className="verified" />}
                      {m.country && (
                        <img className="flag" src={`/flags/${m.country.toLowerCase()}.png`} alt={m.country}
                          onError={(e) => (e.currentTarget.style.display = "none")} />
                      )}
                    </div>
                  )}
                  <span className="text">{m.text}</span>
                  <span className="time">{dayjs(m.createdAt).format("HH:mm")}</span>
                </div>
              </div>
            </div>
          );
        })}
        {!atBottom && (
          <button className="down" onClick={() => { box.current.scrollTop = box.current.scrollHeight; }}>
            ⌄{fresh > 0 && <span className="badge">{fresh}</span>}
          </button>
        )}
      </div>
      <form className="composer" onSubmit={submit} autoComplete="off">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("typeMessage")} maxLength={500} />
        <button className="send" disabled={!text.trim()} aria-label={t("send")}><BiSend /></button>
      </form>
    </section>
  );
}
