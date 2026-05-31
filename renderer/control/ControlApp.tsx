import React, { useEffect, useState } from 'react';
import { Sidebar, type Tab } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { MatchPanel } from './components/panels/MatchPanel';
import { TeamsPanel } from './components/panels/TeamsPanel';
import { UIPanel } from './components/panels/UIPanel';
import { ProfilesPanel } from './components/panels/ProfilesPanel';
import { TournamentPanel } from './components/panels/TournamentPanel';
import { ClipsPanel } from './components/panels/ClipsPanel';
import { PreviewFrame } from './components/preview/PreviewFrame';
import { useConfigStore } from './store/config-store';
import { useRelayStore } from './store/relay-store';

export function ControlApp() {
  const [tab, setTab] = useState<Tab>('match');
  const { loadConfig } = useConfigStore();
  const { init: initRelay } = useRelayStore();

  useEffect(() => {
    loadConfig();
    const cleanup = initRelay();
    return cleanup;
  }, []);

  const panel = {
    match:      <MatchPanel />,
    teams:      <TeamsPanel />,
    ui:         <UIPanel />,
    profiles:   <ProfilesPanel />,
    tournament: <TournamentPanel />,
    replay:     <ClipsPanel />,
    preview:    <PreviewFrame />,
  }[tab];

  return (
    <div className="app">
      <TopBar />
      <div className="app-body">
        <Sidebar active={tab} onChange={setTab} />
        <main className="main-content">
          {panel}
        </main>
      </div>
    </div>
  );
}
