import { useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/usePlayer";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";

export const Header = ({ stats }) => {
  const { nickname } = usePlayer();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-white/5"
        data-testid="header"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 group"
            data-testid="logo-link"
          >
            <Crosshair className="w-5 h-5 text-primary" />
            <span className="font-heading font-bold text-lg uppercase tracking-wider text-foreground">
              Rally Point
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-mono">
            {stats && (
              <>
                <div
                  className="flex items-center gap-2"
                  data-testid="stat-sessions"
                >
                  <div className="live-dot" />
                  <span className="text-muted-foreground">
                    {stats.active_sessions} Active
                  </span>
                </div>
                <div
                  className="flex items-center gap-2"
                  data-testid="stat-players"
                >
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {stats.total_players} Players
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {nickname && (
              <span
                className="text-xs font-mono text-muted-foreground hidden sm:block"
                data-testid="header-nickname"
              >
                {nickname}
              </span>
            )}
            <Button
              onClick={() => setCreateOpen(true)}
              className="uppercase tracking-widest font-bold text-xs active:scale-95"
              size="sm"
              data-testid="create-session-btn"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Host
            </Button>
          </div>
        </div>
      </header>

      <CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};
