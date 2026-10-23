import React, { useState, useEffect } from 'react';
import { Sidebar, NavView } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DailyBriefing } from './components/briefing/DailyBriefing';
import { MemoryTimeline } from './components/timeline/MemoryTimeline';
import { ProjectsView } from './components/projects/ProjectsView';
import { NotebookView } from './components/notebook/NotebookView';
import { FollowUpsView } from './components/followups/FollowUpsView';
import { AssistantView } from './components/assistant/AssistantView';
import { SettingsView } from './components/settings/SettingsView';
import { BrowserSimulatorModal } from './components/simulation/BrowserSimulatorModal';
import { useEvents } from './hooks/useEvents';
import { api } from './services/api';
import { FollowUp, Project, Task, ActivitySession, Note } from './types';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<NavView>('today');
  const [briefing, setBriefing] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<ActivitySession[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [selectedFollowUpForReview, setSelectedFollowUpForReview] = useState<FollowUp | null>(null);

  // Real-time synchronization via Server-Sent Events
  const { connected } = useEvents((event) => {
    // Whenever an event occurs on the backend, refresh active data
    loadAllData();
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [briefingRes, projectsRes, tasksRes, sessionsRes, notesRes, followUpsRes, settingsRes] = await Promise.all([
        api.getBriefing().catch(() => null),
        api.getProjects().catch(() => []),
        api.getTasks().catch(() => []),
        api.getSessions().catch(() => []),
        api.getNotes().catch(() => []),
        api.getFollowUps().catch(() => []),
        api.getSettings().catch(() => null)
      ]);

      if (briefingRes) setBriefing(briefingRes);
      if (projectsRes) setProjects(projectsRes);
      if (tasksRes) setTasks(tasksRes);
      if (sessionsRes) setSessions(sessionsRes);
      if (notesRes) setNotes(notesRes);
      if (followUpsRes) setFollowUps(followUpsRes);
      if (settingsRes?.privacy) {
        setTrackingEnabled(!!settingsRes.privacy.tracking_enabled);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleToggleTracking = async () => {
    const nextState = !trackingEnabled;
    setTrackingEnabled(nextState);
    await api.updateSettings({ tracking_enabled: nextState });
    loadAllData();
  };

  const handleOpenFollowUpReview = (fu: FollowUp) => {
    setSelectedFollowUpForReview(fu);
    setCurrentView('followups');
  };

  const pendingReviewCount = followUps.filter(f => f.state === 'IN_REVIEW' || f.state === 'DRAFT_READY').length;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        pendingReviewCount={pendingReviewCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Sticky Top Header */}
        <Header
          currentView={currentView}
          trackingEnabled={trackingEnabled}
          onToggleTracking={handleToggleTracking}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
          sseConnected={connected}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto">
          {currentView === 'today' && (
            <DailyBriefing
              briefing={briefing}
              onNavigate={setCurrentView}
              onRefresh={loadAllData}
              onOpenFollowUpReview={handleOpenFollowUpReview}
            />
          )}

          {currentView === 'timeline' && (
            <MemoryTimeline
              sessions={sessions}
              onRefresh={loadAllData}
              onOpenSimulator={() => setIsSimulatorOpen(true)}
            />
          )}

          {currentView === 'projects' && (
            <ProjectsView
              projects={projects}
              tasks={tasks}
              onRefresh={loadAllData}
            />
          )}

          {currentView === 'notebook' && (
            <NotebookView
              notes={notes}
              onRefresh={loadAllData}
            />
          )}

          {currentView === 'followups' && (
            <FollowUpsView
              followUps={followUps}
              onRefresh={loadAllData}
              selectedFollowUpForReview={selectedFollowUpForReview}
              onClearReviewSelection={() => setSelectedFollowUpForReview(null)}
            />
          )}

          {currentView === 'assistant' && (
            <AssistantView />
          )}

          {currentView === 'settings' && (
            <SettingsView onRefresh={loadAllData} />
          )}
        </main>
      </div>

      {/* Browser Activity & Security Simulator Modal */}
      <BrowserSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onActivityLogged={loadAllData}
      />
    </div>
  );
};
