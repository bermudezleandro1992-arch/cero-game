import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import HomePage from "./pages/HomePage";
import RoomPage from "./pages/RoomPage";
import GamePage from "./pages/GamePage";
import ConfigWarning from "./components/ConfigWarning";
import { isFirebaseConfigured } from "./lib/firebase";

export default function App() {
  if (!isFirebaseConfigured()) {
    return <ConfigWarning />;
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sala/:code" element={<RoomPage />} />
        <Route path="/juego/:code" element={<GamePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
