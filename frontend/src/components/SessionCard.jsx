import { useNavigate } from "react-router-dom";
import { MapPin, Users, Clock, Shield, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  almost_full: { label: "Almost Full", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
  starting: { label: "Starting", cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  in_progress: { label: "In Progress", cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  ended: { label: "Ended", cls: "bg-muted text-muted-foreground border-muted" },
};

const ACCENT_COLORS = {
  filling: "bg-primary",
  almost_full: "bg-green-500",
  starting: "bg-green-400",
  in_progress: "bg-blue-500",
  ended: "bg-muted-foreground",
};

export const SessionCard = ({ session, featured }) => {
  const navigate = useNavigate();
  const status = STATUS_STYLES[session.status] || STATUS_STYLES.filling;
  const accentColor = ACCENT_COLORS[session.status] || "bg-primary";
  const progress = Math.min(
    (session.ready_count / session.min_players) * 100,
    100
  );
  const trustPercent = Math.round((session.host_success_rate || 0) * 100);

  return (
    <div
      onClick={() => navigate(`/session/${session.id}`)}
      className={`bg-card border border-white/5 relative overflow-hidden group cursor-pointer hover:border-primary/40 transition-colors duration-300 ${featured ? "md:col-span-2" : ""}`}
      data-testid={`session-card-${session.id}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/session/${session.id}`)}
    >
      <div className={`h-0.5 ${accentColor}`} />

      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {session.status !== "ended" && <div className="live-dot" />}
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
            {trustPercent > 0 && (
              <span className="text-primary">{trustPercent}%</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(session.created_at)}</span>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">
                <span className="text-foreground font-bold">
                  {session.ready_count}
                </span>
                /{session.min_players} ready
              </span>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {session.player_count} joined
            </span>
          </div>
          <Progress
            value={progress}
            className="h-1.5"
            data-testid={`session-progress-${session.id}`}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {session.platform}
          </span>
          <div className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Join <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
};
