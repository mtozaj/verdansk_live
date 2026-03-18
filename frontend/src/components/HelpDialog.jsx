import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  Users,
  Globe,
  HelpCircle,
} from "lucide-react";

export const HelpDialog = ({ open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl bg-card border-white/10 max-h-[80vh] overflow-y-auto"
        data-testid="help-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase tracking-wider">
            How It Works
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
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
                  <strong className="text-foreground">Lobby Is Ready</strong>{" "}
                  once you have enough players.
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

          <Separator className="bg-white/5" />

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

          <Separator className="bg-white/5" />

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
      </DialogContent>
    </Dialog>
  );
};
