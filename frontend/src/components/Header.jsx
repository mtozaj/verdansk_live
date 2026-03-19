import { useState } from "react";
import { Link } from "react-router-dom";
import { Crosshair, Plus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/hooks/usePlayer";
import { CreateSessionDialog } from "@/components/CreateSessionDialog";
import { HelpDialog } from "@/components/HelpDialog";

export const Header = ({ stats, onHomeClick }) => {
  const { nickname } = usePlayer();
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
            onClick={(e) => {
              if (!onHomeClick) return;
              e.preventDefault();
              onHomeClick();
            }}
          >
            <Crosshair className="w-5 h-5 text-primary" />
            <span className="font-heading font-bold text-lg uppercase tracking-wider text-foreground">
              Rally Point
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {nickname && (
              <span
                className="text-xs font-mono text-muted-foreground hidden sm:block"
                data-testid="header-nickname"
              >
                {nickname}
              </span>
            )}
            <button
              onClick={() => setHelpOpen(true)}
              className="text-muted-foreground hover:text-primary transition-colors"
              data-testid="help-btn"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
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
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
};
