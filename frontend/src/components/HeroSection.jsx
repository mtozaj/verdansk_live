import { Radio, Target, Eye } from "lucide-react";

export const HeroSection = ({ stats }) => {
  return (
    <section
      className="relative py-12 md:py-16 overflow-hidden"
      data-testid="hero-section"
    >
      <div className="absolute inset-0 grid-bg opacity-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="live-dot" />
            <span className="font-mono text-xs text-primary uppercase tracking-widest">
              Live Coordination Hub
            </span>
          </div>

          <h1
            className="font-heading text-5xl md:text-6xl font-extrabold tracking-tight uppercase text-foreground leading-none mb-4"
            data-testid="hero-title"
          >
            Find Your <span className="text-primary">Verdansk</span> Lobby
          </h1>

          <p className="text-base md:text-lg text-primary font-heading uppercase tracking-wide mb-8">
            Defeat is only a mindset. Shake it off and keep pushing.
          </p>

          <div className="flex flex-wrap gap-6">
            <div
              className="flex items-center gap-2"
              data-testid="hero-stat-active"
            >
              <Radio className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm">
                <span className="text-foreground font-bold">
                  {stats?.active_sessions || 0}
                </span>
                <span className="text-muted-foreground ml-1">
                  active sessions
                </span>
              </span>
            </div>
            <div
              className="flex items-center gap-2"
              data-testid="hero-stat-players"
            >
              <Target className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm">
                <span className="text-foreground font-bold">
                  {stats?.total_players || 0}
                </span>
                <span className="text-muted-foreground ml-1">
                  players joined
                </span>
              </span>
            </div>
            <div
              className="flex items-center gap-2"
              data-testid="hero-stat-online"
            >
              <Eye className="w-4 h-4 text-emerald-500" />
              <span className="font-mono text-sm">
                <span className="text-foreground font-bold">
                  {stats?.online_viewers || 0}
                </span>
                <span className="text-muted-foreground ml-1">
                  users online
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
