import React from 'react';
import { NavView } from './Sidebar';
import { Eye, EyeOff, Radio, Play, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentView: NavView;
  trackingEnabled: boolean;
  onToggleTracking: () => void;
  onOpenSimulator: () => void;
  sseConnected: boolean;
}

const VIEW_TITLES: Record<NavView, { title: string; subtitle: string }> = {
  today: {
    title: 'Today & Contextual Briefing',
    subtitle: 'Resume where you left off, unblock dependencies, and review priority follow-ups.'
  },
  timeline: {
    title: 'Browser Work Sessions & Timeline',
    subtitle: 'Meaningful work context reconstructed from your permitted browser activity.'
  },
  projects: {
    title: 'Active Projects & Goal Tracking',
    subtitle: 'Strategic objectives, task dependency graphs, and progress indicators.'
  },
  notebook: {
    title: 'AI Notebook & Quick Capture',
    subtitle: 'Write unstructured thoughts and transform them into structured plans with human review.'
  },
  followups: {
    title: 'Follow-through Agent & Approvals',
    subtitle: 'Contextual message drafting with explicit human approval gates and duplicate-send protection.'
  },
  assistant: {
    title: 'Continuity AI Assistant',
    subtitle: 'Conversational memory retrieval grounded strictly in your personal sessions and notes.'
  },
  settings: {
    title: 'Settings, Privacy & Security',
    subtitle: 'Manage local retention, excluded domains, AI providers, and full data deletion.'
  }
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  trackingEnabled,
  onToggleTracking,
  onOpenSimulator,
  sseConnected
}) => {
  const info = VIEW_TITLES[currentView];

  return (
    <header className="h-16 border-b border-border bg-[#0d0d10]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-sm font-semibold text-white tracking-tight">{info.title}</h2>
        <p className="text-xs text-muted-foreground">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Engine Stream Status */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
          <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          <span>{sseConnected ? 'Engine Sync Active' : 'Disconnected'}</span>
        </div>

        {/* Browser Simulator Launch Button */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors shadow-subtle"
          title="Simulate visiting any website or test prompt injection defense"
        >
          <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span>Simulate Browser Tab</span>
        </button>

        {/* Global Tracking Switch */}
        <button
          onClick={onToggleTracking}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            trackingEnabled
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          {trackingEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{trackingEnabled ? 'Tracking Permitted' : 'Tracking Paused'}</span>
        </button>
      </div>
    </header>
  );
};
