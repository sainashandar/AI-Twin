import React from 'react';
import { 
  Home, 
  Clock, 
  FolderKanban, 
  FileText, 
  Send, 
  Bot, 
  Settings, 
  ShieldCheck,
  Compass
} from 'lucide-react';

export type NavView = 'today' | 'timeline' | 'projects' | 'notebook' | 'followups' | 'assistant' | 'settings';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  pendingReviewCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView, pendingReviewCount }) => {
  const navItems = [
    { id: 'today' as NavView, label: 'Today & Briefing', icon: Home },
    { id: 'timeline' as NavView, label: 'Memory Timeline', icon: Clock },
    { id: 'projects' as NavView, label: 'Projects & Goals', icon: FolderKanban },
    { id: 'notebook' as NavView, label: 'AI Notebook', icon: FileText },
    { 
      id: 'followups' as NavView, 
      label: 'Follow-through', 
      icon: Send,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined
    },
    { id: 'assistant' as NavView, label: 'AI Assistant', icon: Bot },
    { id: 'settings' as NavView, label: 'Settings & Privacy', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-[#0d0d10] flex flex-col justify-between h-screen select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                Continuity <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AI</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">Personal Continuity Agent</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-subtle'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User / Security Pill */}
      <div className="p-3 m-3 rounded-lg bg-zinc-900/60 border border-border/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
              AM
            </div>
            <div>
              <div className="text-xs font-medium text-zinc-200">Alex Mercer</div>
              <div className="text-[10px] text-zinc-500">Local SQLite Profile</div>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" title="Local Core Engine Online"></span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 pt-1 border-t border-zinc-800/80">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Local-first &bull; Hybrid Sandboxed</span>
        </div>
      </div>
    </aside>
  );
};
