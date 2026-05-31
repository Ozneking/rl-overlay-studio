import React from 'react';

export type Tab = 'match' | 'teams' | 'ui' | 'profiles' | 'tournament' | 'replay' | 'preview';

interface SidebarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: 'match',    icon: '🏆', label: 'Match'    },
  { id: 'teams',    icon: '👥', label: 'Équipes'  },
  { id: 'ui',       icon: '🎨', label: 'Apparence'},
  { id: 'profiles',   icon: '💾', label: 'Profils'   },
  { id: 'tournament', icon: '🏆', label: 'Tournoi'   },
  { id: 'replay',     icon: '🎬', label: 'Replay'    },
  { id: 'preview',    icon: '👁',  label: 'Preview'  },
];

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">⚽</span>
        <span className="sidebar-logo-text">RL Studio v2</span>
      </div>

      <nav className="sidebar-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-item ${active === tab.id ? 'active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="sidebar-icon">{tab.icon}</span>
            <span className="sidebar-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-version">v2.0.0</span>
        <span className="sidebar-credit">Made with ❤️ by Ozneking</span>
      </div>
    </aside>
  );
}
