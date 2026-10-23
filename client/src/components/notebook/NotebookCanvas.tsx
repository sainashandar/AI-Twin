import React, { useState, useRef, useEffect } from 'react';
import { Note, NoteStructure } from '../../types';
import { 
  Sparkles, 
  Check, 
  Trash2, 
  Pin, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Palette, 
  Move, 
  PenTool, 
  Eraser, 
  Target, 
  CheckSquare, 
  ListPlus, 
  Layers, 
  Maximize2,
  Grid
} from 'lucide-react';
import { api } from '../../services/api';

interface NotebookCanvasProps {
  notes: Note[];
  onRefresh: () => void;
  onSelectNote?: (note: Note) => void;
}

type ColorTheme = 'amber' | 'emerald' | 'indigo' | 'rose' | 'cyan' | 'slate';
type GridStyle = 'dots' | 'lines' | 'grid' | 'clean';

const COLOR_MAP: Record<string, { bg: string; border: string; tape: string; text: string; header: string; accent: string }> = {
  amber: {
    bg: 'bg-[#181611]',
    border: 'border-amber-500/30',
    tape: 'bg-amber-400/25 border-amber-400/40',
    text: 'text-amber-100',
    header: 'text-amber-300',
    accent: '#f59e0b'
  },
  emerald: {
    bg: 'bg-[#101713]',
    border: 'border-emerald-500/30',
    tape: 'bg-emerald-400/25 border-emerald-400/40',
    text: 'text-emerald-100',
    header: 'text-emerald-300',
    accent: '#10b981'
  },
  indigo: {
    bg: 'bg-[#12131c]',
    border: 'border-indigo-500/30',
    tape: 'bg-indigo-400/25 border-indigo-400/40',
    text: 'text-indigo-100',
    header: 'text-indigo-300',
    accent: '#6366f1'
  },
  rose: {
    bg: 'bg-[#191114]',
    border: 'border-rose-500/30',
    tape: 'bg-rose-400/25 border-rose-400/40',
    text: 'text-rose-100',
    header: 'text-rose-300',
    accent: '#f43f5e'
  },
  cyan: {
    bg: 'bg-[#0f171b]',
    border: 'border-cyan-500/30',
    tape: 'bg-cyan-400/25 border-cyan-400/40',
    text: 'text-cyan-100',
    header: 'text-cyan-300',
    accent: '#06b6d4'
  },
  slate: {
    bg: 'bg-[#141416]',
    border: 'border-zinc-700/60',
    tape: 'bg-zinc-600/30 border-zinc-500/40',
    text: 'text-zinc-200',
    header: 'text-zinc-300',
    accent: '#71717a'
  }
};

export const NotebookCanvas: React.FC<NotebookCanvasProps> = ({
  notes,
  onRefresh,
  onSelectNote
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [gridStyle, setGridStyle] = useState<GridStyle>('dots');
  const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'pen'>('select');
  const [expandedTrees, setExpandedTrees] = useState<Record<string, boolean>>({});
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [localNotePositions, setLocalNotePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [penColor, setPenColor] = useState('#10b981');
  const [isDrawing, setIsDrawing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync positions from notes
  useEffect(() => {
    const posMap: Record<string, { x: number; y: number }> = {};
    notes.forEach((n, idx) => {
      posMap[n.id] = {
        x: n.position_x ?? 80 + (idx % 3) * 360,
        y: n.position_y ?? 80 + Math.floor(idx / 3) * 340
      };
    });
    setLocalNotePositions(posMap);
  }, [notes]);

  // Handle Canvas Drawing / Pen Tool
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize drawing canvas to container
    const resizeCanvas = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Pan Canvas
  const handleMouseDownBackground = (e: React.MouseEvent) => {
    if (activeTool === 'pan' || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'pen') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(pan.x / zoom, pan.y / zoom);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 3 / zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (draggingNoteId) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const newX = (e.clientX - containerRect.left - pan.x) / zoom - dragOffset.x;
      const newY = (e.clientY - containerRect.top - pan.y) / zoom - dragOffset.y;

      setLocalNotePositions((prev) => ({
        ...prev,
        [draggingNoteId]: { x: Math.max(20, newX), y: Math.max(20, newY) }
      }));
      return;
    }

    if (isDrawing && activeTool === 'pen') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleMouseUp = async () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.restore();
      }
    }
    if (draggingNoteId) {
      const finalPos = localNotePositions[draggingNoteId];
      if (finalPos) {
        // Persist final position to SQLite backend
        await api.updateNote(draggingNoteId, {
          position_x: Math.round(finalPos.x),
          position_y: Math.round(finalPos.y)
        });
      }
      setDraggingNoteId(null);
    }
  };

  const startDragNote = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (activeTool !== 'select') return;
    const pos = localNotePositions[noteId] || { x: 80, y: 80 };
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const mouseX = (e.clientX - containerRect.left - pan.x) / zoom;
    const mouseY = (e.clientY - containerRect.top - pan.y) / zoom;

    setDragOffset({
      x: mouseX - pos.x,
      y: mouseY - pos.y
    });
    setDraggingNoteId(noteId);
  };

  const handleDoubleClickCanvas = async (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && (e.target as HTMLElement).tagName !== 'CANVAS') return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const clickX = (e.clientX - containerRect.left - pan.x) / zoom;
    const clickY = (e.clientY - containerRect.top - pan.y) / zoom;

    await createQuickNoteAt(clickX, clickY);
  };

  const createQuickNoteAt = async (x: number, y: number, color: ColorTheme = 'amber') => {
    const newNote = await api.createNote({
      title: 'New Thought',
      content: 'Write something here or click "⚡ Structure with AI" to generate a plan...',
      position_x: Math.round(x),
      position_y: Math.round(y),
      color
    });
    onRefresh();
  };

  const handleGenerateStructure = async (noteId: string) => {
    setGeneratingId(noteId);
    try {
      await api.generateNoteStructure(noteId);
      setExpandedTrees(prev => ({ ...prev, [noteId]: true }));
      onRefresh();
    } finally {
      setGeneratingId(null);
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

  const handleChangeColor = async (noteId: string, color: ColorTheme) => {
    await api.updateNote(noteId, { color });
    onRefresh();
  };

  const handleDelete = async (noteId: string) => {
    await api.deleteNote(noteId);
    onRefresh();
  };

  const handleToggleTree = (noteId: string) => {
    setExpandedTrees(prev => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  const handleClearDrawings = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleTidyCanvas = async () => {
    // Arrange notes in organic, tidy columns
    const cols = Math.max(2, Math.floor(Math.sqrt(notes.length * 1.5)));
    const colWidth = 380;
    const rowHeight = 360;

    const updatedMap: Record<string, { x: number; y: number }> = {};
    for (let i = 0; i < notes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 80 + col * colWidth;
      const y = 80 + row * rowHeight;
      updatedMap[notes[i].id] = { x, y };
      await api.updateNote(notes[i].id, { position_x: x, position_y: y });
    }
    setLocalNotePositions(updatedMap);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    onRefresh();
  };

  // Get CSS background for chosen grid style
  const getGridBg = () => {
    switch (gridStyle) {
      case 'dots':
        return 'radial-gradient(circle, rgba(255, 255, 255, 0.08) 1px, transparent 1px)';
      case 'lines':
        return 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)';
      case 'grid':
        return 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)';
      case 'clean':
      default:
        return 'none';
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownBackground}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClickCanvas}
      className="relative w-full h-[calc(100vh-8.5rem)] overflow-hidden select-none bg-[#0a0a0d] cursor-default"
      style={{
        backgroundImage: getGridBg(),
        backgroundSize: gridStyle === 'lines' ? '100% 24px' : '24px 24px',
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
    >
      {/* Optional Freehand Sketching Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 ${activeTool === 'pen' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
      />

      {/* Floating Canvas Toolbar */}
      <div className="absolute top-4 left-6 z-30 flex items-center gap-2 p-1.5 rounded-xl bg-[#121215]/90 backdrop-blur-md border border-border shadow-elevated text-xs">
        {/* Tool Selector */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded-md transition-colors ${activeTool === 'select' ? 'bg-emerald-500 text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}
            title="Select & Move Thought Cards"
          >
            <Move className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-1.5 rounded-md transition-colors ${activeTool === 'pan' ? 'bg-emerald-500 text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}
            title="Pan Hand Tool"
          >
            <Layers className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('pen')}
            className={`p-1.5 rounded-md transition-colors ${activeTool === 'pen' ? 'bg-emerald-500 text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}
            title="Freehand Sketch / Doodler Tool"
          >
            <PenTool className="w-4 h-4" />
          </button>
        </div>

        {/* Pen tool options */}
        {activeTool === 'pen' && (
          <div className="flex items-center gap-1.5 px-2 border-l border-border">
            {['#10b981', '#f59e0b', '#6366f1', '#f43f5e', '#ffffff'].map((color) => (
              <button
                key={color}
                onClick={() => setPenColor(color)}
                className={`w-4 h-4 rounded-full border ${penColor === color ? 'border-white scale-125' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              onClick={handleClearDrawings}
              className="p-1 text-zinc-400 hover:text-red-400 ml-1"
              title="Clear sketches"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-border" />

        {/* Quick Add Sticky Note */}
        <button
          onClick={() => createQuickNoteAt(120 - pan.x / zoom, 120 - pan.y / zoom, 'amber')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-colors shadow-subtle"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Thought</span>
        </button>

        {/* Tidy / Auto-Layout */}
        <button
          onClick={handleTidyCanvas}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          title="Auto-arrange notes cleanly"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Tidy Canvas</span>
        </button>

        {/* Grid pattern toggle */}
        <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
          {(['dots', 'lines', 'grid', 'clean'] as GridStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setGridStyle(style)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${gridStyle === style ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              {style}
            </button>
          ))}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 text-zinc-400 px-1 font-mono text-[11px]">
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
            className="p-1 hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(1.75, z + 0.15))}
            className="p-1 hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1 hover:text-white text-[10px]"
            title="Reset viewport"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Helper Banner on canvas */}
      <div className="absolute bottom-4 left-6 z-20 pointer-events-none text-[11px] text-zinc-500 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800">
          💡 Double-click canvas to drop a thought &bull; Drag tape to move &bull; Click "⚡ AI Breakdown" to sprout execution trees
        </span>
      </div>

      {/* Spatial Canvas Container with Pan & Zoom Transform */}
      <div
        className="absolute inset-0 origin-top-left transition-transform duration-75"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
        }}
      >
        {/* SVG Relationship Connector Lines */}
        <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
          {notes.map((note) => {
            const isExpanded = expandedTrees[note.id] !== false && !!note.ai_suggested_structure;
            if (!isExpanded || !note.ai_suggested_structure) return null;

            const pos = localNotePositions[note.id] || { x: 80, y: 80 };
            const cardWidth = 320;
            const cardHeight = 220;

            const startX = pos.x + cardWidth;
            const startY = pos.y + 70;

            // Connected Goal Node position
            const goalX = pos.x + cardWidth + 90;
            const goalY = pos.y - 20;

            // Connected Task Checklist Node position
            const taskX = pos.x + cardWidth + 90;
            const taskY = pos.y + 120;

            const colorKey = note.color || 'amber';
            const accent = COLOR_MAP[colorKey]?.accent || '#f59e0b';

            return (
              <g key={`lines-${note.id}`}>
                {/* Curve to Goal */}
                <path
                  d={`M ${startX} ${startY} C ${startX + 45} ${startY}, ${goalX - 45} ${goalY + 25}, ${goalX} ${goalY + 25}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  className="animate-pulse"
                />
                {/* Curve to Task Checklist */}
                <path
                  d={`M ${startX} ${startY + 20} C ${startX + 45} ${startY + 20}, ${taskX - 45} ${taskY + 40}, ${taskX} ${taskY + 40}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth="2"
                />
                <circle cx={startX} cy={startY} r="4" fill={accent} />
                <circle cx={startX} cy={startY + 20} r="4" fill={accent} />
              </g>
            );
          })}
        </svg>

        {/* Thought Cards & AI Sprout Nodes */}
        {notes.map((note) => {
          const pos = localNotePositions[note.id] || { x: 80, y: 80 };
          const colorKey = note.color || 'amber';
          const theme = COLOR_MAP[colorKey] || COLOR_MAP.amber;
          const isTreeExpanded = expandedTrees[note.id] !== false && !!note.ai_suggested_structure;
          const isGenerating = generatingId === note.id;
          const isAccepting = acceptingId === note.id;

          return (
            <React.Fragment key={note.id}>
              {/* Main Thought Card */}
              <div
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: '320px'
                }}
                className={`absolute z-20 rounded-xl border ${theme.bg} ${theme.border} shadow-elevated transition-shadow duration-150 group`}
              >
                {/* Realistic Tape Top Bar (Draggable handle) */}
                <div
                  onMouseDown={(e) => startDragNote(e, note.id)}
                  className={`relative h-6 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing border-b border-white/5`}
                >
                  {/* Visual Washi Tape Pin in Center */}
                  <div className={`absolute top-[-7px] left-1/2 transform -translate-x-1/2 w-16 h-3.5 rounded-sm ${theme.tape} backdrop-blur-sm border shadow-sm rotate-[-1deg]`}></div>

                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                    {note.is_pinned && <Pin className="w-2.5 h-2.5 text-amber-400" />}
                    <span>{new Date(note.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </div>

                  {/* Top Card Controls */}
                  <div className="flex items-center gap-1 z-10">
                    {/* Color selector palette dropdown */}
                    <div className="relative group/color">
                      <button className="p-0.5 text-zinc-500 hover:text-white rounded">
                        <Palette className="w-3 h-3" />
                      </button>
                      <div className="hidden group-hover/color:flex absolute top-full right-0 mt-1 p-1 rounded-lg bg-zinc-900 border border-zinc-700 gap-1 z-30 shadow-lg">
                        {(['amber', 'emerald', 'indigo', 'rose', 'cyan', 'slate'] as ColorTheme[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => handleChangeColor(note.id, c)}
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: COLOR_MAP[c].accent }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-0.5 text-zinc-500 hover:text-red-400 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 space-y-2">
                  {/* Editable Title */}
                  <input
                    type="text"
                    defaultValue={note.title}
                    onBlur={(e) => {
                      if (e.target.value !== note.title) {
                        api.updateNote(note.id, { title: e.target.value });
                      }
                    }}
                    className={`w-full bg-transparent font-bold text-xs ${theme.header} focus:outline-none border-b border-transparent focus:border-white/20 pb-0.5`}
                  />

                  {/* Lined Notebook Content Area */}
                  <textarea
                    rows={4}
                    defaultValue={note.content}
                    onBlur={(e) => {
                      if (e.target.value !== note.content) {
                        api.updateNote(note.id, { content: e.target.value });
                      }
                    }}
                    className={`w-full bg-transparent text-xs ${theme.text} leading-relaxed focus:outline-none resize-none font-sans`}
                    style={{
                      backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                      backgroundSize: '100% 22px',
                      lineHeight: '22px'
                    }}
                  />

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {note.tags?.map((t) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-zinc-400 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* Action Bar: Structure with AI */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                    {note.ai_suggested_structure ? (
                      <button
                        onClick={() => handleToggleTree(note.id)}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 text-[10px]"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>{isTreeExpanded ? 'Collapse AI Branches' : 'Expand AI Branches'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleGenerateStructure(note.id)}
                        disabled={isGenerating}
                        className="px-2.5 py-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-semibold transition-colors flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{isGenerating ? 'Structuring...' : '⚡ Structure with AI'}</span>
                      </button>
                    )}

                    {note.accepted_structure && (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        Integrated
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sprouted AI Branch Nodes (Connected Right on the Canvas) */}
              {isTreeExpanded && note.ai_suggested_structure && (
                <>
                  {/* 1. Sprouted Goal Node */}
                  {note.ai_suggested_structure.goal && (
                    <div
                      style={{
                        left: `${pos.x + 410}px`,
                        top: `${pos.y - 40}px`,
                        width: '280px'
                      }}
                      className="absolute z-20 p-3 rounded-xl bg-zinc-900/90 border border-emerald-500/40 backdrop-blur-md shadow-elevated animate-in fade-in zoom-in-95 duration-200"
                    >
                      <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] uppercase font-bold tracking-wider mb-1">
                        <Target className="w-3 h-3" />
                        <span>Proposed Strategic Goal</span>
                      </div>
                      <p className="text-xs text-white font-medium leading-snug">
                        {note.ai_suggested_structure.goal}
                      </p>
                    </div>
                  )}

                  {/* 2. Sprouted Checklist & Milestones Node */}
                  <div
                    style={{
                      left: `${pos.x + 410}px`,
                      top: `${pos.y + 60}px`,
                      width: '320px'
                    }}
                    className="absolute z-20 p-3.5 rounded-xl bg-zinc-900/95 border border-indigo-500/40 backdrop-blur-md shadow-elevated animate-in fade-in zoom-in-95 duration-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] uppercase font-bold tracking-wider">
                        <CheckSquare className="w-3 h-3" />
                        <span>Extracted Action Plan</span>
                      </div>

                      {note.accepted_structure ? (
                        <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                          Active in Tasks
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAcceptStructure(note.id)}
                          disabled={isAccepting}
                          className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-[10px] transition-colors flex items-center gap-1 shadow-subtle"
                        >
                          <ListPlus className="w-3 h-3" />
                          <span>{isAccepting ? 'Instantiating...' : 'Accept Tasks'}</span>
                        </button>
                      )}
                    </div>

                    {/* Milestones list */}
                    {note.ai_suggested_structure.milestones && (
                      <div className="space-y-1">
                        <span className="text-[9px] uppercase font-semibold text-zinc-500 block">Milestones</span>
                        {note.ai_suggested_structure.milestones.slice(0, 2).map((m, idx) => (
                          <div key={idx} className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 text-[9px] text-zinc-400 flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <span className="truncate">{m}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actionable Tasks */}
                    {note.ai_suggested_structure.tasks && (
                      <div className="space-y-1 pt-1 border-t border-border/60">
                        <span className="text-[9px] uppercase font-semibold text-zinc-500 block">Tasks</span>
                        {note.ai_suggested_structure.tasks.slice(0, 3).map((t, idx) => (
                          <div key={idx} className="p-1.5 rounded bg-zinc-800/60 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-200 truncate mr-2">{t.title}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-300 shrink-0">
                              {t.estimated_minutes || 30}m
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
