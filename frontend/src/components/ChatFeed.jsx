import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageSquare } from "lucide-react";

function timeStr(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Parse message text and return array of segments: plain text and mentions
function parseMessageWithMentions(text, players, currentPlayerId) {
  if (!text || !players || players.length === 0) {
    return [{ type: "text", value: text }];
  }

  // Build a set of nicknames for quick lookup
  const nicknameMap = {};
  for (const p of players) {
    nicknameMap[p.nickname.toLowerCase()] = p;
  }

  const segments = [];
  // Match @word patterns (word can contain letters, numbers, underscores, hyphens, spaces if quoted)
  const regex = /@(\S+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const mentionText = match[1];
    const player = nicknameMap[mentionText.toLowerCase()];

    if (player) {
      // Add preceding text
      if (match.index > lastIndex) {
        segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      segments.push({
        type: "mention",
        value: `@${mentionText}`,
        playerId: player.player_id,
        isMe: player.player_id === currentPlayerId,
      });
      lastIndex = regex.lastIndex;
    }
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    return [{ type: "text", value: text }];
  }

  return segments;
}

// Render message with highlighted mentions
function MessageText({ text, players, currentPlayerId }) {
  const segments = useMemo(
    () => parseMessageWithMentions(text, players, currentPlayerId),
    [text, players, currentPlayerId]
  );

  return (
    <p className="text-foreground/80 mt-0.5 break-words [overflow-wrap:anywhere]">
      {segments.map((seg, i) => {
        if (seg.type === "mention") {
          return (
            <span
              key={i}
              className={`font-bold ${
                seg.isMe
                  ? "text-primary bg-primary/20 px-0.5 rounded-sm"
                  : "text-primary"
              }`}
            >
              {seg.value}
            </span>
          );
        }
        return <span key={i}>{seg.value}</span>;
      })}
    </p>
  );
}

export const ChatFeed = ({
  messages,
  onSend,
  currentPlayerId,
  hostId,
  unreadCount = 0,
  players = [],
}) => {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const mentionListRef = useRef(null);
  const focusScrollRef = useRef(null);

  const handleInputFocus = useCallback(() => {
    clearTimeout(focusScrollRef.current);
    focusScrollRef.current = setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 350);
  }, []);

  useEffect(() => {
    const viewport = bottomRef.current?.closest(
      "[data-radix-scroll-area-viewport]"
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => clearTimeout(focusScrollRef.current);
  }, []);

  // Filter players based on mention query
  const filteredPlayers = useMemo(() => {
    if (!showMentions) return [];
    const query = mentionFilter.toLowerCase();
    return players.filter(
      (p) =>
        p.nickname.toLowerCase().includes(query) &&
        p.player_id !== currentPlayerId
    );
  }, [showMentions, mentionFilter, players, currentPlayerId]);

  // Reset mention index when filtered list changes
  useEffect(() => {
    setMentionIndex(0);
  }, [filteredPlayers.length, mentionFilter]);

  const insertMention = useCallback(
    (nickname) => {
      if (mentionStartPos < 0) return;
      const before = text.slice(0, mentionStartPos);
      const cursorPos = inputRef.current?.selectionStart ?? text.length;
      const after = text.slice(cursorPos);
      const newText = `${before}@${nickname} ${after}`;
      setText(newText);
      setShowMentions(false);
      setMentionFilter("");
      setMentionStartPos(-1);

      // Refocus input and set cursor after the inserted mention
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const pos = before.length + nickname.length + 2; // +2 for @ and space
          inputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [text, mentionStartPos]
  );

  const handleInputChange = useCallback(
    (e) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart;
      setText(value);

      // Check if we should show/update mention autocomplete
      // Find the last @ before cursor that isn't preceded by a non-space char
      const textBeforeCursor = value.slice(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      if (lastAtIndex >= 0) {
        // Check that @ is at start or preceded by a space
        const charBefore = lastAtIndex > 0 ? value[lastAtIndex - 1] : " ";
        if (charBefore === " " || lastAtIndex === 0) {
          const query = textBeforeCursor.slice(lastAtIndex + 1);
          // Only show if query doesn't contain spaces (single word mention)
          if (!query.includes(" ")) {
            setShowMentions(true);
            setMentionFilter(query);
            setMentionStartPos(lastAtIndex);
            return;
          }
        }
      }

      setShowMentions(false);
      setMentionFilter("");
      setMentionStartPos(-1);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!showMentions || filteredPlayers.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev < filteredPlayers.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredPlayers.length - 1
        );
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (showMentions && filteredPlayers.length > 0) {
          e.preventDefault();
          insertMention(filteredPlayers[mentionIndex].nickname);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowMentions(false);
        setMentionFilter("");
        setMentionStartPos(-1);
      }
    },
    [showMentions, filteredPlayers, mentionIndex, insertMention]
  );

  const handleSend = async (e) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    const success = await onSend(msg);
    if (success) {
      setText("");
      setShowMentions(false);
      setMentionFilter("");
      setMentionStartPos(-1);
    }
  };

  // Scroll active mention into view
  useEffect(() => {
    if (!mentionListRef.current) return;
    const active = mentionListRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [mentionIndex]);

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
            const isMsgHost = msg.player_id === hostId;
            return (
              <div
                key={msg.id}
                className={`text-xs font-mono py-1.5 px-2 break-words overflow-hidden min-w-0 ${
                  isMsgHost
                    ? "bg-primary/10 border-l-2 border-primary"
                    : isMe
                    ? "bg-white/[0.05] border-l-2 border-white/20"
                    : "bg-white/[0.02]"
                }`}
                data-testid={`chat-msg-${msg.id}`}
              >
                <span
                  className={`font-bold ${
                    isMsgHost ? "text-primary" : "text-foreground"
                  }`}
                >
                  {msg.nickname}
                </span>
                {isMsgHost && (
                  <span className="ml-1.5 text-[9px] font-bold uppercase tracking-widest bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                    Host
                  </span>
                )}
                <span className="text-muted-foreground/60 ml-2">
                  {timeStr(msg.timestamp)}
                </span>
                <MessageText
                  text={msg.message}
                  players={players}
                  currentPlayerId={currentPlayerId}
                />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Mention autocomplete dropdown */}
      <div className="relative">
        {showMentions && filteredPlayers.length > 0 && (
          <div
            ref={mentionListRef}
            className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-white/10 shadow-lg max-h-36 overflow-y-auto z-50"
            data-testid="mention-dropdown"
          >
            {filteredPlayers.map((p, i) => (
              <button
                key={p.player_id}
                type="button"
                data-active={i === mentionIndex}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 transition-colors ${
                  i === mentionIndex
                    ? "bg-primary/20 text-primary"
                    : "text-foreground hover:bg-white/5"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur
                  insertMention(p.nickname);
                }}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <span className="font-bold truncate">{p.nickname}</span>
                {p.player_id === hostId && (
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-primary/20 text-primary px-1 py-0.5 rounded shrink-0">
                    Host
                  </span>
                )}
                <span className="text-muted-foreground/60 text-[10px] capitalize ml-auto shrink-0">
                  {p.state?.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="flex gap-2 mt-2 pt-2 border-t border-white/5"
        >
          <Input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            placeholder="Type @ to mention..."
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
    </div>
  );
};
