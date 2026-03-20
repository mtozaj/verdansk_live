import { useNavigate } from "react-router-dom";
import { MapPin, Users, Clock, Shield, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getSessionDisplayState, getSessionStartProgress } from "@/lib/sessionMetrics";

function timeAgo(dateStr) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATUS_STYLES = {
  filling: { label: "Filling", cls: "bg-primary/20 text-primary border-primary/30" },
  ready_to_start: { label: "Ready to Start", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  almost_full: { label: "Almost Full", cls: "bg-primary/20 text-primary border-primary/30" },
  full: { label: "Full", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  starting: { label: "Match Starting Soon", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  in_progress: { label: "Match Started", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground border-muted" },
  expired: { label: "Expired", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const ACCENT_COLORS = {
  filling: "bg-primary",
  ready_to_start: "bg-emerald-500",
  almost_full: "bg-primary",
  full: "bg-red-500",
  starting: "bg-blue-500",
  in_progress: "bg-green-500",
  ended: "bg-muted-foreground",
  expired: "bg-red-500",
};

export const SessionCard = ({ session, featured, playerId }) => {
  const navigate = useNavigate();
  const displayState = getSessionDisplayState(session);
  const status = STATUS_STYLES[displayState] || STATUS_STYLES.filling;
  const accentColor = ACCENT_COLORS[displayState] || "bg-primary";
  const progress = getSessionStartProgress(session);
  const myPlayer = playerId && session.players?.find((p) => p.player_id === playerId);
  const amInLobby = myPlayer?.state === "in_lobby";

  return (
    <div
      onClick={() => navigate(`/session/${session.id}`)}
      className={`bg-card border relative overflow-hidden group cursor-pointer transition-colors duration-300 ${
        amInLobby
          ? "border-emerald-500/40 hover:border-emerald-500/60"
          : "border-white/5 hover:border-primary/40"
      } ${featured ? "md:col-span-2" : ""}`}
      data-testid={`session-card-${session.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${session.id}`)}
    >
      <div className={`h-0.5 ${accentColor}`} />

      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {!["ended", "expired"].includes(displayState) && <div className="live-dot" />}
            <span className="font-heading font-bold text-sm uppercase tracking-wide text-primary/80">
              Verdansk
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-mono uppercase tracking-wider border ${status.cls}`}
            data-testid={`session-status-${session.id}`}
          >
            {status.label}
          </Badge>
        </div>

        {amInLobby && (
          <div
            className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 mb-3"
            data-testid={`in-lobby-badge-${session.id}`}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-wider font-bold">
              You're in this lobby
            </span>
          </div>
        )}

        <h3
          className="font-heading text-lg font-bold text-foreground mb-3 line-clamp-1"
          data-testid={`session-title-${session.id}`}
        >
          {session.title}
        </h3>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-mono mb-4">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span>{session.region}</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            <span>{session.host_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(session.created_at)}</span>
          </div>
          {session.code_updated_at && (
            <div className={`flex items-center gap-1 ${
              (Date.now() - new Date(session.code_updated_at).getTime()) < 300000
                ? "text-green-400"
                : ""
            }`}>
              <RefreshCw className="w-3 h-3" />
              <span>code updated {timeAgo(session.code_updated_at)}</span>
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">
                <span className="text-foreground font-bold">
                  {session.in_lobby_count}
                </span>
                /{session.min_players} in lobby
              </span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {session.in_lobby_count}/{session.max_players} capacity
            </span>
          </div>
          <Progress
            value={progress}
            className="h-1.5"
            data-testid={`session-progress-${session.id}`}
          />
          <div className="flex justify-between items-center mt-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <span>{session.interested_count} interested</span>
            <span>{session.joining_count} joining soon</span>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            {session.host_inactive && (
              <div className="flex items-center gap-1 text-yellow-500 text-xs font-mono" data-testid={`host-inactive-${session.id}`}>
                <AlertTriangle className="w-3 h-3" />
                <span className="uppercase tracking-wider text-[10px] font-bold">Host Inactive</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Join <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
