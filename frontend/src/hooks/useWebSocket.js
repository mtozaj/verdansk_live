import { useEffect, useRef, useState, useCallback } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_BASE = BACKEND_URL.replace("https://", "wss://").replace(
  "http://",
  "ws://"
);

export function useWebSocket(path, onMessage) {
  const wsRef = useRef(null);
  const onMsgRef = useRef(onMessage);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef(null);
  const pingTimer = useRef(null);

  useEffect(() => {
    onMsgRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    let alive = true;

    function connect() {
      if (!alive) return;
      const ws = new WebSocket(`${WS_BASE}${path}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!alive) return;
        setConnected(true);
        // Identify this user for accurate online count
        const pid = localStorage.getItem("rp_player_id");
        if (pid) {
          ws.send(JSON.stringify({ type: "identify", player_id: pid }));
        }
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 25000);
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type !== "pong" && onMsgRef.current) {
            onMsgRef.current(data);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        clearInterval(pingTimer.current);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimer.current);
      clearInterval(pingTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [path]);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === "string" ? data : JSON.stringify(data));
    }
  }, []);

  return { connected, send };
}
