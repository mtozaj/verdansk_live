import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";

function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export const ChatFeed = ({ messages, onSend, currentPlayerId, hostId, unreadCount = 0 }) => {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const viewport = bottomRef.current?.closest('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
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
      <div className="flex items-center gap-2 mb-2 px-1">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h3 className="font-heading text-sm uppercase tracking-wider text-foreground font-bold">
          Chat
        </h3>
        {unreadCount > 0 && (
          <div className="flex items-center gap-1.5" data-testid="chat-unread-badge">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-[10px] text-primary font-bold">
              {unreadCount}
            </span>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-1.5 pr-3 pb-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-8 font-mono">
              No messages yet
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.player_id === currentPlayerId;
            const isHost = msg.player_id === hostId;
            return (
              <div
                key={msg.id}
                className={`text-xs font-mono py-1.5 px-2 ${
                  isHost
                    ? "bg-primary/10 border-l-2 border-primary"
                    : isMe
                    ? "bg-white/[0.05] border-l-2 border-white/20"
                    : "bg-white/[0.02]"
                }`}
                data-testid={`chat-msg-${msg.id}`}
              >
                <span
                  className={`font-bold ${
                    isHost ? "text-primary" : "text-foreground"
                  }`}
                >
                  {msg.nickname}
                </span>
                {isHost && (
                  <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    Host
                  </span>
                )}
                <span className="text-muted-foreground/60 ml-2">
                  {timeStr(msg.timestamp)}
                </span>
                <p className="text-foreground/80 mt-0.5">{msg.message}</p>
              </div>
            );
          })}
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
