import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { PlayerProvider } from "@/hooks/usePlayer";
import { WelcomeRules } from "@/components/WelcomeRules";
import "@/App.css";
import HomePage from "@/pages/HomePage";
import SessionPage from "@/pages/SessionPage";

function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(0 0% 5%)",
              border: "1px solid hsl(240 4% 16%)",
              color: "hsl(0 0% 95%)",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
            },
          }}
        />
        <WelcomeRules />
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/session/:id" element={<SessionPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </PlayerProvider>
  );
}

export default App;
