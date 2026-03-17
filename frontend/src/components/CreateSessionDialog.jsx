import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlayer } from "@/hooks/usePlayer";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CreateSessionDialog = ({ open, onOpenChange }) => {
  const { playerId, nickname, hasNickname } = usePlayer();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    match_code: "",
    region: "North America",
    platform: "Cross-play",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasNickname) {
      toast.error("Set your username first");
      return;
    }
    if (!form.title.trim() || !form.match_code.trim()) {
      toast.error("Title and match code are required");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/sessions`, {
        ...form,
        host_name: nickname,
        host_id: playerId,
      });
      toast.success("Session created!");
      onOpenChange(false);
      navigate(`/session/${res.data.id}`);
      setForm({
        title: "",
        match_code: "",
        map_name: "Verdansk",
        region: "North America",
        game_mode: "Battle Royale",
        platform: "Cross-play",
        min_players: 24,
      });
    } catch {
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg bg-card border-white/10"
        data-testid="create-session-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-xl uppercase tracking-wider">
            Host a Private Match
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
              Session Title
            </Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder='e.g. "Verdansk BR - Need 24 players"'
              className="bg-secondary/50 border-white/10 font-mono text-sm"
              data-testid="create-title-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
              Match Code
            </Label>
            <Input
              value={form.match_code}
              onChange={(e) =>
                setForm({ ...form, match_code: e.target.value.toUpperCase() })
              }
              placeholder="Enter private match code"
              className="bg-secondary/50 border-white/10 font-mono text-sm"
              data-testid="create-code-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider font-mono text-muted-foreground">
              Region
            </Label>
            <Select
              value={form.region}
              onValueChange={(v) => setForm({ ...form, region: v })}
            >
              <SelectTrigger
                className="bg-secondary/50 border-white/10 text-xs font-mono"
                data-testid="create-region-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="North America">North America</SelectItem>
                <SelectItem value="South America">South America</SelectItem>
                <SelectItem value="Europe">Europe</SelectItem>
                <SelectItem value="Middle East">Middle East</SelectItem>
                <SelectItem value="Africa">Africa</SelectItem>
                <SelectItem value="Asia">Asia</SelectItem>
                <SelectItem value="Oceania">Oceania</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground/60 font-mono">
              Pick your region. Players closer to the host get lower ping.
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full uppercase tracking-widest font-bold text-xs active:scale-95"
            data-testid="create-submit-btn"
          >
            {loading ? "Creating..." : "Go Live"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
