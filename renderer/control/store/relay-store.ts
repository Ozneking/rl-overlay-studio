import { create } from 'zustand';
import type { RelayStatus } from '../types';

interface RelayStore {
  rlConnected: boolean;
  relayReady: boolean;
  lastMessage: string;
  init: () => () => void;
}

function applyStatus(data: RelayStatus) {
  return {
    rlConnected: data.rlConnected,
    relayReady: true,
    lastMessage: data.rlConnected
      ? 'RL connecté'
      : data.message === 'connected_to_rocket_league'
        ? 'RL connecté'
        : data.error
          ? `Erreur: ${data.error}`
          : 'En attente de RL…',
  };
}

export const useRelayStore = create<RelayStore>((set) => ({
  rlConnected: false,
  relayReady: false,
  lastMessage: 'Connexion…',

  init: () => {
    // 1. Pull current state immediately (request/response) so we never wait for the
    //    next push event — relay may already be connected before this window loads.
    window.electronAPI.getRelayStatus().then((data: RelayStatus) => {
      set(applyStatus(data));
    }).catch(() => {
      // Ignore — push listener below will handle eventual updates
    });

    // 2. Register push listener for live updates (RL connects / disconnects later)
    const cleanup = window.electronAPI.onRelayStatus((data: RelayStatus) => {
      set(applyStatus(data));
    });

    return cleanup;
  },
}));
