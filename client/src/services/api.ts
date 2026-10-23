import { Project, Task, ActivitySession, Memory, Note, FollowUp, PrivacySettings, ExcludedDomain } from '../types';

const BASE_URL = '/api';

export const api = {
  // Briefing & Resume
  getBriefing: async () => {
    const res = await fetch(`${BASE_URL}/briefing`);
    return res.json();
  },
  getResumeContext: async () => {
    const res = await fetch(`${BASE_URL}/briefing/resume`);
    return res.json();
  },

  // Activity & Sessions
  recordActivity: async (data: { url: string; title: string; content?: string; durationSeconds?: number; projectId?: string }) => {
    const res = await fetch(`${BASE_URL}/activity/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  getSessions: async (limit = 20): Promise<ActivitySession[]> => {
    const res = await fetch(`${BASE_URL}/activity/sessions?limit=${limit}`);
    return res.json();
  },
  getSessionDetails: async (id: string): Promise<ActivitySession> => {
    const res = await fetch(`${BASE_URL}/activity/sessions/${id}`);
    return res.json();
  },
  summarizeSession: async (id: string): Promise<ActivitySession> => {
    const res = await fetch(`${BASE_URL}/activity/sessions/${id}/summarize`, { method: 'POST' });
    return res.json();
  },
  deleteSession: async (id: string) => {
    const res = await fetch(`${BASE_URL}/activity/sessions/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Memory & Search
  getMemories: async (type?: string, projectId?: string): Promise<Memory[]> => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (projectId) params.append('projectId', projectId);
    const res = await fetch(`${BASE_URL}/memory?${params.toString()}`);
    return res.json();
  },
  searchMemories: async (query: string): Promise<Memory[]> => {
    const res = await fetch(`${BASE_URL}/memory/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },
  addMemory: async (data: Partial<Memory>) => {
    const res = await fetch(`${BASE_URL}/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  askAssistant: async (question: string) => {
    const res = await fetch(`${BASE_URL}/memory/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    return res.json();
  },
  deleteMemory: async (id: string) => {
    const res = await fetch(`${BASE_URL}/memory/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Projects
  getProjects: async (): Promise<Project[]> => {
    const res = await fetch(`${BASE_URL}/projects`);
    return res.json();
  },
  getProjectDetails: async (id: string) => {
    const res = await fetch(`${BASE_URL}/projects/${id}/details`);
    return res.json();
  },
  createProject: async (data: { name: string; description?: string; color?: string }) => {
    const res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Tasks
  getTasks: async (status?: string, projectId?: string): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (projectId) params.append('projectId', projectId);
    const res = await fetch(`${BASE_URL}/tasks?${params.toString()}`);
    return res.json();
  },
  createTask: async (data: Partial<Task> & { projectId?: string; estimatedMinutes?: number; priorityLevel?: string }) => {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        projectId: data.project_id || data.projectId,
        estimatedMinutes: data.estimated_minutes || data.estimatedMinutes,
        priorityLevel: data.priority_level || data.priorityLevel
      })
    });
    return res.json();
  },
  updateTask: async (id: string, updates: Partial<Task>) => {
    const res = await fetch(`${BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },
  getRecommendation: async (availableMinutes = 90) => {
    const res = await fetch(`${BASE_URL}/tasks/recommendation?availableMinutes=${availableMinutes}`);
    return res.json();
  },

  // Notebook
  getNotes: async (projectId?: string): Promise<Note[]> => {
    const res = await fetch(`${BASE_URL}/notes${projectId ? `?projectId=${projectId}` : ''}`);
    return res.json();
  },
  createNote: async (data: Partial<Note> & { content: string }) => {
    const res = await fetch(`${BASE_URL}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateNote: async (id: string, updates: Partial<Note>) => {
    const res = await fetch(`${BASE_URL}/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },
  generateNoteStructure: async (id: string) => {
    const res = await fetch(`${BASE_URL}/notes/${id}/generate-structure`, { method: 'POST' });
    return res.json();
  },
  acceptNoteStructure: async (id: string) => {
    const res = await fetch(`${BASE_URL}/notes/${id}/accept-structure`, { method: 'POST' });
    return res.json();
  },
  deleteNote: async (id: string) => {
    const res = await fetch(`${BASE_URL}/notes/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Follow-ups & Approvals
  getFollowUps: async (state?: string): Promise<FollowUp[]> => {
    const res = await fetch(`${BASE_URL}/follow-ups${state ? `?state=${state}` : ''}`);
    return res.json();
  },
  createFollowUp: async (data: Partial<FollowUp>) => {
    const res = await fetch(`${BASE_URL}/follow-ups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  updateDraft: async (id: string, updates: { subject?: string; body?: string; recipient?: string }) => {
    const res = await fetch(`${BASE_URL}/follow-ups/${id}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return res.json();
  },
  approveFollowUp: async (id: string) => {
    const res = await fetch(`${BASE_URL}/follow-ups/${id}/approve`, { method: 'POST' });
    return res.json();
  },
  sendFollowUp: async (id: string) => {
    const res = await fetch(`${BASE_URL}/follow-ups/${id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ explicitUserGesture: true })
    });
    return res.json();
  },
  cancelFollowUp: async (id: string, reason?: string) => {
    const res = await fetch(`${BASE_URL}/follow-ups/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    return res.json();
  },
  getAuditLog: async (id: string) => {
    const res = await fetch(`${BASE_URL}/follow-ups/${id}/audit`);
    return res.json();
  },
  simulateReply: async (recipientEmail: string, replySnippet: string) => {
    const res = await fetch(`${BASE_URL}/follow-ups/simulate-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientEmail, replySnippet })
    });
    return res.json();
  },
  getExecutionRecords: async () => {
    const res = await fetch(`${BASE_URL}/follow-ups/execution-records`);
    return res.json();
  },

  // Settings & Privacy
  getSettings: async (): Promise<{ privacy: PrivacySettings; excludedDomains: ExcludedDomain[] }> => {
    const res = await fetch(`${BASE_URL}/settings`);
    return res.json();
  },
  updateSettings: async (settings: Partial<PrivacySettings>) => {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  },
  addExcludedDomain: async (domain: string, reason?: string) => {
    const res = await fetch(`${BASE_URL}/settings/excluded-domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, reason })
    });
    return res.json();
  },
  deleteExcludedDomain: async (id: string) => {
    const res = await fetch(`${BASE_URL}/settings/excluded-domains/${id}`, { method: 'DELETE' });
    return res.json();
  },
  exportData: async () => {
    window.open(`${BASE_URL}/settings/export-data`, '_blank');
  },
  wipeAllData: async () => {
    const res = await fetch(`${BASE_URL}/settings/delete-all-data`, { method: 'POST' });
    return res.json();
  }
};
