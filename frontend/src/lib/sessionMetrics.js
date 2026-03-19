export function getSessionDisplayState(session) {
  if (!session) {
    return "filling";
  }

  if (session.lobby_expired && ["filling", "almost_full", "starting"].includes(session.status)) {
    return "expired";
  }

  if (["starting", "in_progress", "ended"].includes(session.status)) {
    return session.status;
  }

  const minPlayers = session.min_players ?? 50;
  const maxPlayers = session.max_players ?? 152;
  const inLobbyCount = session.in_lobby_count ?? 0;

  if (inLobbyCount >= maxPlayers) {
    return "full";
  }

  if (inLobbyCount >= maxPlayers * 0.8) {
    return "almost_full";
  }

  if (inLobbyCount >= minPlayers) {
    return "ready_to_start";
  }

  return "filling";
}

export function getSessionStartProgress(session) {
  if (!session) {
    return 0;
  }

  const minPlayers = session.min_players ?? 50;
  const inLobbyCount = session.in_lobby_count ?? 0;

  return Math.min((inLobbyCount / minPlayers) * 100, 100);
}
