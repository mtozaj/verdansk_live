import { createContext, useContext, useState } from "react";

const PlayerContext = createContext(null);

function generateId() {
  return (
    "p_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  );
}

export function PlayerProvider({ children }) {
  const [playerId] = useState(() => {
    const stored = localStorage.getItem("rp_player_id");
    if (stored) return stored;
    const id = generateId();
    localStorage.setItem("rp_player_id", id);
    return id;
  });

  const [nickname, setNicknameState] = useState(() => {
    return localStorage.getItem("rp_nickname") || "";
  });

  const [rulesAccepted, setRulesAcceptedState] = useState(() => {
    return localStorage.getItem("rp_rules_accepted") === "true";
  });

  const setNickname = (name) => {
    setNicknameState(name);
    localStorage.setItem("rp_nickname", name);
  };

  const acceptRules = () => {
    localStorage.setItem("rp_rules_accepted", "true");
    setRulesAcceptedState(true);
  };

  return (
    <PlayerContext.Provider
      value={{
        playerId,
        nickname,
        setNickname,
        hasNickname: !!nickname,
        rulesAccepted,
        acceptRules,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
