import React, { useState } from 'react';
import { ActivitySession } from '../../types';
import { 
  Clock, 
  ExternalLink, 
  Sparkles, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  Globe,
  Filter
} from 'lucide-react';
import { api } from '../../services/api';

interface MemoryTimelineProps {
  sessions: ActivitySession[];
  onRefresh: () => void;
  onOpenSimulator: () => void;
}

export const MemoryTimeline: React.FC<MemoryTimelineProps> = ({
  sessions,
  onRefresh,
  onOpenSimulator
}) => {
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);

  const handleSummarize = async (sessionId: string) => {
    setSummarizingId(sessionId);
    try {
      await api.summarizeSession(sessionId);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSummarizingId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (confirm('Delete this work session and all associated page records?')) {
      await api.deleteSession(sessionId);
      if (selectedSession?.id === sessionId) setSelectedSession(null);
      onRefresh();
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Controls Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#121215] border border-border">
        <div>
          <h3 className="text-sm font-semibold text-white">Browser Activity Sessions</h3>
          <p className="text-xs text-zinc-400">
            Sessions are automatically grouped using inactivity thresholds and domain patterns.
          </p>
        </div>

        <button
          onClick={onOpenSimulator}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-emerald-400 border border-zinc-700 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Simulate Tab Activity</span>
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#121215] border border-border border-dashed">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-zinc-300">No browser sessions recorded yet</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
            Browse permitted pages with the extension active, or use the simulator to create your first session.
          </p>
          <button
            onClick={onOpenSimulator}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-colors"
          >
            Launch Browser Simulator
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const isSummarizing = summarizingId === session.id;
            return (
              <div
                key={session.id}
                className="p-5 rounded-xl bg-[#121215] border border-border hover:border-zinc-700 transition-colors shadow-card"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <h4 className="text-sm font-semibold text-white tracking-tight">{session.title}</h4>
                    {session.project_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {session.project_name}
                      </span>
                    )}
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {session.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>
                      {new Date(session.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      &bull; {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>&bull;</span>
                    <span>{session.page_count} pages</span>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                  {session.summary}
                </p>

                {/* Extracted Decisions, Blockers, Next Steps */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 text-xs">
                  {/* Decisions */}
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1.5 text-[11px] uppercase tracking-wider">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Decisions Identified</span>
                    </div>
                    {session.decisions && session.decisions.length > 0 ? (
                      <ul className="space-y-1 text-zinc-300 text-[11px]">
                        {session.decisions.map((d, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-emerald-500">&bull;</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-500 text-[11px] italic">No explicit decisions recorded</span>
                    )}
                  </div>

                  {/* Blockers */}
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1.5 text-[11px] uppercase tracking-wider">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Identified Blockers</span>
                    </div>
                    {session.blockers && session.blockers.length > 0 ? (
                      <ul className="space-y-1 text-zinc-300 text-[11px]">
                        {session.blockers.map((b, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-amber-500">&bull;</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-500 text-[11px] italic">No active blockers detected</span>
                    )}
                  </div>

                  {/* Next Steps */}
                  <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1.5 text-[11px] uppercase tracking-wider">
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Next Actions</span>
                    </div>
                    {session.next_steps && session.next_steps.length > 0 ? (
                      <ul className="space-y-1 text-zinc-300 text-[11px]">
                        {session.next_steps.map((s, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-indigo-400">&bull;</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-zinc-500 text-[11px] italic">Ready for next assignment</span>
                    )}
                  </div>
                </div>

                {/* Evidence References / Visited URLs */}
                {session.evidence_references && session.evidence_references.length > 0 && (
                  <div className="mb-3 text-[11px]">
                    <span className="text-zinc-500 font-medium mr-2">Verified Sources:</span>
                    <div className="inline-flex flex-wrap gap-2 mt-1">
                      {session.evidence_references.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-zinc-400 hover:text-emerald-400 flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 font-mono text-[10px] transition-colors"
                        >
                          <span className="truncate max-w-[220px]">{url}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-border/80 text-xs">
                  <button
                    onClick={() => handleSummarize(session.id)}
                    disabled={isSummarizing}
                    className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSummarizing ? 'Analyzing context with AI...' : 'Re-summarize with AI'}</span>
                  </button>

                  <button
                    onClick={() => handleDelete(session.id)}
                    className="flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-colors text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Session</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
