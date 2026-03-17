import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crosshair } from "lucide-react";
import { usePlayer } from "@/hooks/usePlayer";

export const NicknamePrompt = () => {
  const { hasNickname, setNickname, rulesAccepted } = usePlayer();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(!hasNickname);

  // Lock body scroll on iOS while dialog is open
  const isVisible = open && !hasNickname && rulesAccepted;
  useEffect(() => {
    if (!isVisible) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, 0);
    };
  }, [isVisible]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = value.trim();
    if (name.length >= 2) {
      setNickname(name);
      setOpen(false);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  };

  if (hasNickname) return null;
  if (!rulesAccepted) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md bg-card border-white/10 [&>button]:hidden"
        data-testid="nickname-dialog"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crosshair className="w-5 h-5 text-primary" />
            <DialogTitle className="font-heading text-xl uppercase tracking-wider">
              Set Your Username
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Choose a name other players will see when you join sessions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex gap-2 mt-4">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter username..."
            className="bg-secondary/50 border-white/10 font-mono text-sm placeholder:text-muted-foreground/50"
            maxLength={20}
            autoFocus
            data-testid="nickname-input"
          />
          <Button
            type="submit"
            disabled={value.trim().length < 2}
            className="uppercase tracking-widest font-bold text-xs"
            data-testid="nickname-submit"
          >
            Deploy
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
