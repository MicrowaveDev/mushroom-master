/**
 * SSE composable for challenge mode real-time events.
 *
 * Opens an EventSource to /api/game-run/:id/events when in challenge mode prep screen.
 * Handles: opponent ready/unready, round result, opponent abandon, run ended.
 */
export function useSSE(state, goTo) {
  let eventSource = null;

  function connect() {
    disconnect();
    if (!state.gameRun || state.gameRun.mode !== 'challenge') return;
    if (!state.sessionKey) return;

    const url = `/api/game-run/${state.gameRun.id}/events`;
    eventSource = new EventSource(url, {
      // Note: EventSource doesn't support custom headers natively.
      // The session key is passed via cookie or query param fallback.
      // For now, we rely on the cookie-based auth that the server already supports.
    });

    // Workaround: append session key as query param since EventSource doesn't support headers
    const urlWithAuth = `${url}?sessionKey=${encodeURIComponent(state.sessionKey)}`;
    eventSource.close();
    eventSource = new EventSource(urlWithAuth);

    eventSource.addEventListener('ready', (e) => {
      try {
        const data = JSON.parse(e.data);
        state.opponentReady = !!data.ready;
      } catch { /* ignore malformed */ }
    });

    eventSource.addEventListener('round_result', (e) => {
      try {
        const data = JSON.parse(e.data);
        state.gameRunResult = data;
        if (data.status === 'completed' || data.status === 'abandoned') {
          state.gameRun = { ...state.gameRun, status: data.status, endReason: data.endReason };
          goTo('runComplete');
        } else {
          goTo('roundResult');
        }
      } catch { /* ignore malformed */ }
    });

    eventSource.addEventListener('opponent_abandoned', () => {
      state.error = state.lang === 'ru' ? 'Противник покинул игру' : 'Opponent left the game';
      state.gameRun = state.gameRun ? { ...state.gameRun, status: 'abandoned', endReason: 'opponent_abandoned' } : null;
      disconnect();
      goTo('runComplete');
    });

    eventSource.addEventListener('run_ended', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (state.gameRun) {
          state.gameRun = { ...state.gameRun, status: 'completed', endReason: data.endReason || 'max_rounds' };
        }
      } catch { /* ignore */ }
      disconnect();
      goTo('runComplete');
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects on error; we just reset the ready indicator
      state.opponentReady = false;
    };
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    state.opponentReady = false;
  }

  return { connect, disconnect };
}
