import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatFeed = ({ messages, onSend, currentPlayerId }) => {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="chat-feed">
      <h3 className="font-heading text-sm uppercase tracking-wider text-muted-foreground mb-2 px-1">
        Comms
      </h3>
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-1.5 pr-3 pb-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-8 font-mono">
              No messages yet
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-xs font-mono py-1.5 px-2 ${
                msg.player_id === currentPlayerId
                  ? "bg-primary/10 border-l-2 border-primary"
                  : "bg-white/[0.02]"
              }`}
              data-testid={`chat-msg-${msg.id}`}
            >
              <span
                className={`font-bold ${
                  msg.player_id === currentPlayerId
                    ? "text-primary"
                    : "text-foreground"
                }`}
              >
                {msg.nickname}
              </span>
              <span className="text-muted-foreground/60 ml-2">
                {timeStr(msg.timestamp)}
              </span>
              <p className="text-foreground/80 mt-0.5">{msg.message}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <form
        onSubmit={handleSend}
        className="flex gap-2 mt-2 pt-2 border-t border-white/5"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          className="bg-secondary/50 border-white/10 font-mono text-xs h-8 placeholder:text-muted-foreground/50"
          maxLength={200}
          data-testid="chat-input"
        />
        <Button
          type="submit"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!text.trim()}
          data-testid="chat-send-btn"
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
};
