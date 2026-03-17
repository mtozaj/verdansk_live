import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Crosshair,
  Shield,
  Users,
  Globe,
  ChevronRight,
} from "lucide-react";
import { usePlayer } from "@/hooks/usePlayer";

export const WelcomeRules = () => {
  const { rulesAccepted, acceptRules } = usePlayer();

  // Lock body scroll on iOS while welcome screen is showing
  useEffect(() => {
    if (rulesAccepted) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [rulesAccepted]);

  if (rulesAccepted) return null;

  const handleAccept = () => {
    acceptRules();
  };

  return (
    <div
      data-testid="welcome-screen"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "hsl(0 0% 3.5%)",
        overflowY: "scroll",
        WebkitOverflowScrolling: "touch",
      }}
      className="welcome-scroll"
    >
      <div className="max-w-xl w-full mx-auto px-4 py-8">
        <div className="bg-card border border-white/10">
          {/* Header */}
          <div className="p-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Crosshair className="w-6 h-6 text-primary" />
              <h1 className="font-heading text-3xl font-bold uppercase tracking-tight text-foreground">
                Rally Point
              </h1>
            </div>
            <p className="text-lg text-primary font-heading uppercase tracking-wide">
              Let's bring Verdansk back.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This is a live coordination hub for Warzone Verdansk private
              matches. Read these quick guidelines to keep sessions running
              smoothly for everyone.
            </p>
          </div>

          <Separator className="bg-white/5" />

          {/* Rules content */}
          <div className="p-6 space-y-6">
            {/* Host rules */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="font-heading text-lg uppercase tracking-wider text-foreground font-bold">
                  If You're Hosting
                </h2>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground font-mono">
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Choose the region closest to you. Players in the same
                    region will have lower ping and a smoother experience.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Wait for enough players to fill the lobby before starting
                    the match.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Press{" "}
                    <strong className="text-foreground">Start Match</strong>{" "}
                    once the game has actually launched in-game.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Press{" "}
                    <strong className="text-foreground">End Session</strong>{" "}
                    when the match is over or if you need to cancel.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Update the match code if it changes so joiners always
                    have the latest one.
                  </span>
                </li>
              </ul>
            </div>

            {/* Joiner rules */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="font-heading text-lg uppercase tracking-wider text-foreground font-bold">
                  If You're Joining
                </h2>
              </div>
              <ul className="space-y-2.5 text-sm text-muted-foreground font-mono">
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Pick sessions in your region for the best connection.
                    Closer servers mean lower latency in-game.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Mark yourself as{" "}
                    <strong className="text-foreground">Joining</strong> when
                    you're ready to commit. This unlocks the match code for
                    you.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Mark yourself as{" "}
                    <strong className="text-foreground">In The Lobby</strong>{" "}
                    once you've actually entered the private match in-game.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">&mdash;</span>
                  <span>
                    Leave the session if you can't make it so the player
                    count stays accurate for everyone else.
                  </span>
                </li>
              </ul>
            </div>

            {/* Region note */}
            <div className="bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="font-heading text-sm uppercase tracking-wider text-primary font-bold">
                  Why Region Matters
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                Private matches are hosted on the lobby creator's server
                region. Players who are geographically closer to the host
                will have lower ping, resulting in smoother gameplay and
                fewer lag spikes. Always try to join or host sessions in
                your region.
              </p>
            </div>
          </div>

          <Separator className="bg-white/5" />

          {/* Button */}
          <div className="p-6">
            <Button
              onClick={handleAccept}
              className="w-full uppercase tracking-widest font-bold text-sm active:scale-95 h-12 glow-primary"
              data-testid="welcome-accept-btn"
            >
              I Understand — Let Me In
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
