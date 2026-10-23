import React, { useState } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Flame, 
  Lightbulb, 
  RotateCcw, 
  Send, 
  ShieldCheck, 
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../services/api';
import { NavView } from '../layout/Sidebar';

interface DailyBriefingProps {
  briefing: any;
  onNavigate: (view: NavView) => void;
  onRefresh: () => void;
  onOpenFollowUpReview: (followUp: any) => void;
}

export const DailyBriefing: React.FC<DailyBriefingProps> = ({
  briefing,
  onNavigate,
  onRefresh,
  onOpenFollowUpReview
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(90);
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  if (!briefing) {
    return (
      <div className="p-8 text-center text-zinc-500 animate-pulse">
        Reconstructing personal memory and daily briefing...
      </div>
    );
  }

  const { greeting, lastSession, recommendedNextAction, pendingFollowUps, projects, recentNotes } = briefing;

  const handleResumeClick = async () => {
    try {
      const data = await api.getResumeContext();
      setResumeData(data);
      setResumeModalOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkTaskComplete = async (taskId: string) => {
    setLoadingAction(true);
    try {
      await api.updateTask(taskId, { status: 'completed' });
      onRefresh();
    } finally {
      setLoadingAction(false);
    }
  };

  const handleTimeChange = async (minutes: number) => {
    setSelectedMinutes(minutes);
    try {
      await api.getRecommendation(minutes);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-xl bg-gradient-to-r from-zinc-900 via-[#131418] to-zinc-900 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Personal Continuity</span>
            <span className="text-zinc-600">&bull;</span>
            <span className="text-xs text-zinc-400">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {greeting}, Alex.
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Continuity AI has reconstructed your last active state from permitted browser sessions, prioritized your unfinished tasks, and staged pending follow-ups for your review.
          </p>
        </div>

        <button
          onClick={handleResumeClick}
          className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-all flex items-center gap-2 shadow-subtle hover:scale-[1.02] shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Resume Where I Left Off</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recommended Next Action & Resumption */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recommended Next Action Card */}
          {recommendedNextAction?.hasRecommendation && (
            <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-emerald-400" />
              
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Flame className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Recommended Next Action</span>
                </div>

                {/* Available Focus Window Selector */}
                <div className="flex items-center gap-1 text-[11px] bg-zinc-900 border border-zinc-800 p-1 rounded-lg">
                  <span className="text-zinc-400 px-1">Available Focus:</span>
                  {[30, 60, 90].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleTimeChange(m)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                        selectedMinutes === m
                          ? 'bg-emerald-500 text-black font-semibold'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Details */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {recommendedNextAction.task.project_name || 'General Project'}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Priority Score: {recommendedNextAction.task.priority_score}/100
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      ~{recommendedNextAction.task.estimated_minutes} min
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white tracking-tight">
                    {recommendedNextAction.task.title}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {recommendedNextAction.task.description}
                  </p>
                </div>

                {/* AI Explanation Callout */}
                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-300 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-semibold text-white">Why now: </span>
                    {recommendedNextAction.explanation}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    disabled={loadingAction}
                    onClick={() => handleMarkTaskComplete(recommendedNextAction.task.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-medium text-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Complete</span>
                  </button>
                  <button
                    onClick={() => onNavigate('projects')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors"
                  >
                    View in Project Graph
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Last Known Session Context Card */}
          {lastSession && (
            <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Where You Left Off</span>
                </div>
                <span className="text-[11px] text-zinc-500">
                  {new Date(lastSession.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <h4 className="text-sm font-semibold text-white mb-1.5">{lastSession.title}</h4>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">{lastSession.summary}</p>

              {/* Identified Decisions & Blockers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {lastSession.decisions?.length > 0 && (
                  <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs">
                    <span className="font-semibold text-emerald-400 block mb-1">Key Decision Identified:</span>
                    <span className="text-zinc-300">{lastSession.decisions[0]}</span>
                  </div>
                )}
                {lastSession.blockers?.length > 0 && (
                  <div className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 text-xs">
                    <span className="font-semibold text-amber-400 block mb-1">Identified Blocker:</span>
                    <span className="text-zinc-300">{lastSession.blockers[0]}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                <span className="text-zinc-500">{lastSession.page_count} permitted pages visited in this session</span>
                <button
                  onClick={() => onNavigate('timeline')}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium text-xs"
                >
                  <span>Open Full Timeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Active Projects Overview */}
          <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Active Projects & Progress</h4>
              <button
                onClick={() => onNavigate('projects')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                View All Projects &rarr;
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {projects?.map((p: any) => (
                <div key={p.id} className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: p.color || '#10b981' }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2">{p.description}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{p.open_tasks_count} open tasks</span>
                    <span>{p.goals_count} goals</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Follow-ups & Notes */}
        <div className="space-y-6">
          {/* Pending Follow-ups Awaiting Approval */}
          <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-pink-400" />
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Follow-up Approvals</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                {pendingFollowUps?.length || 0} Awaiting Review
              </span>
            </div>

            {pendingFollowUps && pendingFollowUps.length > 0 ? (
              <div className="space-y-3">
                {pendingFollowUps.map((fu: any) => (
                  <div key={fu.id} className="p-3 rounded-lg bg-zinc-900/70 border border-pink-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate">{fu.recipient}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400">
                        {fu.state}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300 font-medium line-clamp-1">{fu.subject}</div>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 italic">
                      "{fu.current_body}"
                    </p>
                    <button
                      onClick={() => onOpenFollowUpReview(fu)}
                      className="w-full py-1.5 rounded-md bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-xs font-medium transition-colors text-center"
                    >
                      Inspect Draft & Authorize &rarr;
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-500 text-xs">
                No follow-ups pending review. All commitments are up to date.
              </div>
            )}
          </div>

          {/* Recent Notes & Ideas */}
          <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">Recent Thoughts</span>
              </div>
              <button
                onClick={() => onNavigate('notebook')}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Open Notebook &rarr;
              </button>
            </div>

            {recentNotes && recentNotes.length > 0 ? (
              <div className="space-y-2.5">
                {recentNotes.map((n: any) => (
                  <div key={n.id} className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs space-y-1">
                    <div className="font-semibold text-zinc-200">{n.title}</div>
                    <p className="text-zinc-400 text-[11px] line-clamp-2">{n.content}</p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {n.tags?.map((t: string) => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-zinc-500 text-xs">
                Capture thoughts in AI Notebook to auto-organize into plans.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resume Modal */}
      {resumeModalOpen && resumeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#121215] border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-elevated">
            <div className="p-4 border-b border-border flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Contextual Resumption Pack</h3>
              </div>
              <button
                onClick={() => setResumeModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded bg-zinc-800"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold block mb-1">
                  Last Active Work Session
                </span>
                <h4 className="text-base font-bold text-white">{resumeData.session?.title}</h4>
                <p className="text-zinc-300 mt-1">{resumeData.session?.summary}</p>
              </div>

              {resumeData.session?.decisions?.length > 0 && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                  <span className="font-semibold text-emerald-400 block mb-1">Decisions Made Before You Stopped:</span>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    {resumeData.session.decisions.map((d: string, idx: number) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {resumeData.session?.pages?.length > 0 && (
                <div>
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold block mb-2">
                    Permitted Tabs You Had Open ({resumeData.session.pages.length})
                  </span>
                  <div className="space-y-1.5">
                    {resumeData.session.pages.map((p: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-zinc-900/70 border border-zinc-800 flex items-center justify-between">
                        <div className="truncate mr-2">
                          <div className="font-medium text-white truncate">{p.title}</div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">{p.url}</div>
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 p-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resumeData.relatedTasks?.length > 0 && (
                <div>
                  <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold block mb-2">
                    Unfinished Tasks For This Project
                  </span>
                  <div className="space-y-1">
                    {resumeData.relatedTasks.map((t: any) => (
                      <div key={t.id} className="p-2 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                        <span className="text-zinc-200">{t.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          Score: {t.priority_score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
