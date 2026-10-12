import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import { useApp } from "./context/AppContext";

export default function App() {
  const { toast } = useApp();
  const { pathname } = useLocation();
  const inChat = pathname.startsWith("/r/");
  return (
    <div className={`app ${inChat ? "in-chat" : ""}`}>
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Empty />} />
          <Route path="/r/:slug" element={<ChatView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {toast && <div className="toast" role="alert">{toast}</div>}
    </div>
  );
}

function Empty() {
  // Desktopda birinchi xonani avtomatik ochamiz; mobilda ro'yxat ko'rinadi
  const { rooms } = useApp();
  if (window.matchMedia("(min-width: 800px)").matches && rooms[0])
    return <Navigate to={`/r/${rooms[0].slug}`} replace />;
  return <div className="empty-main">💬</div>;
}
