import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { FilterBar } from "@/components/FilterBar";
import { SessionCard } from "@/components/SessionCard";
import { NicknamePrompt } from "@/components/NicknamePrompt";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Radio } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function HomePage() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    region: "all",
    status: "all",
  });
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    try {
      const params = {};
      if (filters.region !== "all") params.region = filters.region;
      if (filters.status !== "all") params.status = filters.status;
      const res = await axios.get(`${API}/sessions`, { params });
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    fetchStats();
    // Refresh online count periodically
    const statsInterval = setInterval(fetchStats, 15000);
    return () => clearInterval(statsInterval);
  }, [fetchSessions, fetchStats]);

  const handleWsMessage = useCallback(
    (data) => {
      if (data.type === "new_session") {
        setSessions((prev) => [data.session, ...prev]);
        toast("New session available!", {
          description: data.session.title,
        });
        if (
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification("Rally Point", {
              body: `New session: ${data.session.title}`,
            });
          } catch {
            // ignore
          }
        }
      } else if (data.type === "session_updated") {
        setSessions((prev) =>
          prev
            .map((s) => (s.id === data.session.id ? data.session : s))
            .filter((s) => s.status !== "ended")
        );
        if (
          data.session.ready_count >=
          data.session.min_players * 0.8 &&
          data.session.status === "filling"
        ) {
          toast(`${data.session.title} is almost full!`);
        }
      }
      fetchStats();
    },
    [fetchStats]
  );

  useWebSocket("/api/ws/lobby", handleWsMessage);

  const sorted = [...sessions].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div className="min-h-screen" data-testid="home-page">
      <NicknamePrompt />
      <Header stats={stats} />
      <HeroSection stats={stats} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex items-center justify-between mb-6">
          <FilterBar filters={filters} onChange={setFilters} />
          <span className="text-xs font-mono text-muted-foreground hidden md:block">
            {sorted.length} session{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-card border border-white/5 h-48 animate-pulse"
              />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20" data-testid="no-sessions">
            <Radio className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-xl uppercase text-muted-foreground mb-2">
              No Active Sessions
            </h3>
            <p className="text-sm text-muted-foreground">
              Be the first to host a Verdansk private match.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sorted.map((session, i) => (
              <div
                key={session.id}
                className={`animate-slide-up stagger-${Math.min(i + 1, 6)}`}
                style={{ opacity: 0 }}
              >
                <SessionCard session={session} featured={i === 0} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
