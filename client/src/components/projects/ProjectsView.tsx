import React, { useState } from 'react';
import { Project, Task, Goal } from '../../types';
import { 
  FolderKanban, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Target, 
  AlertTriangle,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  onRefresh: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  tasks,
  onRefresh
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id || null);
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectColor, setProjectColor] = useState('#10b981');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskEstimated, setNewTaskEstimated] = useState(30);

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const projectTasks = tasks.filter(t => t.project_id === activeProject?.id);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    await api.createProject({
      name: projectName.trim(),
      description: projectDesc.trim(),
      color: projectColor
    });
    setNewProjectModal(false);
    setProjectName('');
    setProjectDesc('');
    onRefresh();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeProject) return;
    await api.createTask({
      title: newTaskTitle.trim(),
      project_id: activeProject.id,
      estimated_minutes: Number(newTaskEstimated) || 30,
      priority_level: 'medium'
    });
    setNewTaskTitle('');
    onRefresh();
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    await api.updateTask(task.id, { status: nextStatus });
    onRefresh();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#121215] border border-border">
        <div>
          <h3 className="text-sm font-semibold text-white">Project Memory & Workstreams</h3>
          <p className="text-xs text-zinc-400">
            Active projects, associated goals, and calculated priority tasks.
          </p>
        </div>

        <button
          onClick={() => setNewProjectModal(true)}
          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-subtle"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Project Selector (Sidebar List) */}
        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-zinc-400 block px-1">
            Projects ({projects.length})
          </label>
          {projects.map((p) => {
            const isSelected = p.id === activeProject?.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-[#18181f] border-emerald-500/40 shadow-subtle'
                    : 'bg-[#121215] border-border hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white truncate mr-2">{p.name}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#10b981' }}
                  />
                </div>
                <p className="text-[11px] text-zinc-400 line-clamp-1 mb-2">{p.description}</p>
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{p.active_tasks_count || 0} active tasks</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-600'}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Project Details & Task Graph (Right 3 cols) */}
        {activeProject && (
          <div className="lg:col-span-3 space-y-6">
            {/* Active Project Banner */}
            <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: activeProject.color || '#10b981' }}
                  />
                  <h3 className="text-base font-bold text-white tracking-tight">{activeProject.name}</h3>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {activeProject.status}
                </span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed mb-4">{activeProject.description}</p>

              {/* Quick Task Creation Form */}
              <form onSubmit={handleCreateTask} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a new task or commitment to this project..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  placeholder="Mins"
                  value={newTaskEstimated}
                  onChange={(e) => setNewTaskEstimated(Number(e.target.value))}
                  className="w-20 px-3 py-2 bg-zinc-900 border border-border rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-emerald-400 border border-zinc-700 transition-colors"
                >
                  Add Task
                </button>
              </form>
            </div>

            {/* Task Dependency & Priority List */}
            <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Tasks & Intelligent Priority ({projectTasks.length})
                </h4>
                <span className="text-[11px] text-zinc-500">Sorted by dynamic priority score</span>
              </div>

              {projectTasks.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  No tasks currently recorded for this project.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projectTasks.map((task) => {
                    const isCompleted = task.status === 'completed';
                    const isBlocked = task.status === 'blocked';
                    return (
                      <div
                        key={task.id}
                        className={`p-3.5 rounded-lg border transition-all ${
                          isCompleted
                            ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60'
                            : isBlocked
                            ? 'bg-amber-950/10 border-amber-500/30'
                            : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1">
                            <button
                              onClick={() => handleToggleTaskStatus(task)}
                              className="mt-0.5 text-zinc-400 hover:text-emerald-400 transition-colors"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>

                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-xs font-semibold ${isCompleted ? 'line-through text-zinc-400' : 'text-white'}`}>
                                  {task.title}
                                </span>
                                {task.is_ai_recommended && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    AI Rec
                                  </span>
                                )}
                              </div>

                              {task.description && (
                                <p className="text-[11px] text-zinc-400 line-clamp-1 mb-1.5">
                                  {task.description}
                                </p>
                              )}

                              {isBlocked && task.blocker_reason && (
                                <div className="text-[10px] text-amber-400 flex items-center gap-1 mt-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Blocked: {task.blocker_reason}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-right shrink-0">
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              Score: {task.priority_score}
                            </span>
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {task.estimated_minutes}m
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {newProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#121215] border border-border rounded-xl w-full max-w-md overflow-hidden shadow-elevated p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-300 block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next-Gen Mobile App"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Key objectives and context..."
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="text-zinc-300 block mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  {['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setProjectColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        projectColor === color ? 'scale-110 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setNewProjectModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
