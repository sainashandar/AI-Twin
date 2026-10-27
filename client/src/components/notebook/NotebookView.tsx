import React, { useState } from 'react';
import { Note } from '../../types';
import { 
  FileText, 
  Sparkles, 
  Check, 
  Trash2, 
  Pin, 
  Tag, 
  Send, 
  Target, 
  CheckSquare, 
  ListPlus,
  ArrowRight,
  LayoutGrid,
  Layers,
  Palette,
  Sun,
  Moon
} from 'lucide-react';
import { api } from '../../services/api';
import { NotebookCanvas, CanvasTheme } from './NotebookCanvas';

interface NotebookViewProps {
  notes: Note[];
  onRefresh: () => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({
  notes,
  onRefresh
}) => {
  const [viewMode, setViewMode] = useState<'canvas' | 'document'>('canvas');
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>(() => {
    return (localStorage.getItem('continuity_canvas_theme') as CanvasTheme) || 'dark';
  });
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(notes[0] || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleToggleTheme = () => {
    setCanvasTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('continuity_canvas_theme', next);
      return next;
    });
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsCapturing(true);
    try {
      // Place near upper left in canvas with subtle jitter
      const posX = 100 + (notes.length % 4) * 340;
      const posY = 100 + Math.floor(notes.length / 4) * 320;
      const colors = ['amber', 'emerald', 'indigo', 'rose', 'cyan'];
      const chosenColor = colors[notes.length % colors.length];

      const created = await api.createNote({
        title: newNoteTitle.trim() || undefined,
        content: newNoteContent.trim(),
        position_x: posX,
        position_y: posY,
        color: chosenColor
      });
      setNewNoteContent('');
      setNewNoteTitle('');
      onRefresh();
      setSelectedNote(created);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleAcceptStructure = async (noteId: string) => {
    setAcceptingId(noteId);
    try {
      await api.acceptNoteStructure(noteId);
      onRefresh();
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (confirm('Delete this note?')) {
      await api.deleteNote(noteId);
      if (selectedNote?.id === noteId) setSelectedNote(null);
      onRefresh();
    }
  };

  const activeNote = notes.find(n => n.id === selectedNote?.id) || notes[0];
  const isLightCanvas = viewMode === 'canvas' && canvasTheme === 'light';

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar with Mode Switcher & Quick Capture */}
      <div className={`p-4 px-6 border-b transition-colors duration-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0 ${
        isLightCanvas ? 'bg-[#f5f4ef] border-zinc-200' : 'bg-[#0d0d10]/90 border-border backdrop-blur-md'
      }`}>
        {/* Left: Quick Capture Bar */}
        <form onSubmit={handleCreateNote} className="flex-1 flex items-center gap-2 max-w-2xl">
          <input
            type="text"
            placeholder="Jot down a thought, ambition, or meeting takeaway..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
              isLightCanvas 
                ? 'bg-white border border-zinc-300 text-zinc-900 placeholder-zinc-400' 
                : 'bg-zinc-900 border border-border text-white placeholder-zinc-500'
            }`}
          />
          <button
            type="submit"
            disabled={isCapturing || !newNoteContent.trim()}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-subtle"
          >
            <Send className="w-3 h-3 fill-black" />
            <span>{isCapturing ? 'Adding...' : 'Drop on Canvas'}</span>
          </button>
        </form>

        {/* Right: Controls (Theme Toggle & View Mode Toggle) */}
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {viewMode === 'canvas' && (
            <button
              onClick={handleToggleTheme}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isLightCanvas
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title={canvasTheme === 'light' ? 'Switch Canvas to Dark Mode' : 'Switch Canvas to Light Paper Mode'}
            >
              {canvasTheme === 'light' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span className="font-semibold text-xs">Light Paper</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
                  <span className="font-semibold text-xs">Dark Canvas</span>
                </>
              )}
            </button>
          )}

          <div className={`flex items-center gap-1 p-1 rounded-lg border transition-colors ${
            isLightCanvas ? 'bg-zinc-200/80 border-zinc-300' : 'bg-zinc-900 border-zinc-800'
          }`}>
            <button
              onClick={() => setViewMode('canvas')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'canvas'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : (isLightCanvas ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200')
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Canvas</span>
            </button>

            <button
              onClick={() => setViewMode('document')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'document'
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : (isLightCanvas ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200')
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Document</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Canvas vs Classic Document View */}
      {viewMode === 'canvas' ? (
        <NotebookCanvas
          notes={notes}
          onRefresh={onRefresh}
          onSelectNote={setSelectedNote}
          theme={canvasTheme}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        <div className="p-6 max-w-6xl mx-auto space-y-6 flex-1 overflow-y-auto">
          {/* Notes Browser Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Note List */}
            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block px-1">
                Saved Notes ({notes.length})
              </label>

              {notes.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs rounded-xl bg-[#121215] border border-border">
                  No notes saved yet. Capture your first thought above!
                </div>
              ) : (
                notes.map((n) => {
                  const isSelected = n.id === activeNote?.id;
                  return (
                    <div
                      key={n.id}
                      onClick={() => setSelectedNote(n)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#18181f] border-emerald-500/40 shadow-subtle'
                          : 'bg-[#121215] border-border hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white truncate mr-2">{n.title}</span>
                        {n.is_pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-2 mb-2">{n.content}</p>

                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex flex-wrap gap-1">
                          {n.tags?.slice(0, 2).map((t) => (
                            <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                              #{t}
                            </span>
                          ))}
                        </div>

                        {n.accepted_structure ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3" />
                            Integrated
                          </span>
                        ) : n.ai_suggested_structure ? (
                          <span className="text-pink-400 font-semibold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Plan Ready
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right 2 Columns: Selected Note & AI Breakdown */}
            {activeNote && (
              <div className="lg:col-span-2 space-y-4">
                {/* Note Content Display */}
                <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">{activeNote.title}</h3>
                      <span className="text-[11px] text-zinc-500">
                        Captured {new Date(activeNote.created_at).toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(activeNote.id)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap mb-4">
                    {activeNote.content}
                  </div>

                  {/* AI Structural Proposal */}
                  {activeNote.ai_suggested_structure ? (
                    <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 via-[#15171e] to-zinc-900 border border-emerald-500/30 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            AI Structured Execution Proposal
                          </h4>
                        </div>

                        {activeNote.accepted_structure ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Approved & Added to Projects
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAcceptStructure(activeNote.id)}
                            disabled={acceptingId === activeNote.id}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-subtle"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                            <span>{acceptingId === activeNote.id ? 'Instantiating...' : 'Accept & Add to Tasks'}</span>
                          </button>
                        )}
                      </div>

                      {/* Proposed Goal */}
                      {activeNote.ai_suggested_structure.goal && (
                        <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                            <Target className="w-3.5 h-3.5" />
                            <span>Proposed Goal</span>
                          </div>
                          <div className="text-white font-medium">{activeNote.ai_suggested_structure.goal}</div>
                        </div>
                      )}

                      {/* Proposed Milestones */}
                      {activeNote.ai_suggested_structure.milestones && (
                        <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                            Key Milestones
                          </span>
                          <ul className="space-y-1">
                            {activeNote.ai_suggested_structure.milestones.map((m, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-zinc-300">
                                <span className="w-4 h-4 rounded-full bg-zinc-800 text-[10px] flex items-center justify-center text-zinc-400 font-bold shrink-0">
                                  {idx + 1}
                                </span>
                                <span>{m}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Proposed Tasks */}
                      {activeNote.ai_suggested_structure.tasks && (
                        <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                            Actionable Tasks Extracted
                          </span>
                          <div className="space-y-1.5">
                            {activeNote.ai_suggested_structure.tasks.map((t, idx) => (
                              <div key={idx} className="p-2 rounded bg-zinc-800/60 flex items-center justify-between text-xs">
                                <span className="text-zinc-200">{t.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                                    {t.priority || 'medium'}
                                  </span>
                                  <span className="text-[10px] text-zinc-400">{t.estimated_minutes || 30}m</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
