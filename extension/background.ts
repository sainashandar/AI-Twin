// Chrome Extension MV3 Background Service Worker for Continuity AI

const DEFAULT_SERVER_URL = 'http://localhost:3001';

interface TrackingState {
  enabled: boolean;
  browserWide: boolean;
  activeProjectId: string | null;
  serverUrl: string;
}

let state: TrackingState = {
  enabled: true,
  browserWide: true,
  activeProjectId: null,
  serverUrl: DEFAULT_SERVER_URL
};

// Initialize state from storage
chrome.storage.local.get(['tracking_enabled', 'browser_wide', 'active_project_id', 'server_url'], (items) => {
  state.enabled = items.tracking_enabled !== false;
  state.browserWide = items.browser_wide !== false;
  state.activeProjectId = items.active_project_id || null;
  state.serverUrl = items.server_url || DEFAULT_SERVER_URL;
  updateBadge();
});

// Update badge display
function updateBadge(text = '', color = '#10b981') {
  if (!state.enabled) {
    chrome.action.setBadgeText({ text: 'PAUSED' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    return;
  }
  chrome.action.setBadgeText({ text: text || 'ON' });
  chrome.action.setBadgeBackgroundColor({ color });
}

// Check domain exclusion with local engine
async function checkExclusion(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${state.serverUrl}/api/activity/check-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    return data.excluded === true;
  } catch (e) {
    // Fallback safe heuristic if local server isn't reachable
    const sensitive = ['chase.com', 'bankofamerica.com', 'paypal.com', 'login', 'auth', 'signin'];
    return sensitive.some(s => url.toLowerCase().includes(s));
  }
}

// Ingest page visit into Continuity AI engine
async function reportActivity(url: string, title: string, content = '') {
  if (!state.enabled) return;

  const isExcluded = await checkExclusion(url);
  if (isExcluded) {
    updateBadge('SKIP', '#ef4444');
    return;
  }

  try {
    const res = await fetch(`${state.serverUrl}/api/activity/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title,
        content,
        projectId: state.activeProjectId,
        durationSeconds: 15
      })
    });
    if (res.ok) {
      updateBadge('ON', '#10b981');
    }
  } catch (err) {
    console.warn('[Continuity Extension] Local engine not reachable at', state.serverUrl);
  }
}

// Tab listeners
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    reportActivity(tab.url, tab.title || '');
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith('http')) {
      reportActivity(tab.url, tab.title || '');
    }
  } catch (e) {
    // Tab might be closing
  }
});

// Message listener from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_STATUS') {
    sendResponse({ state });
    return true;
  }

  if (request.type === 'TOGGLE_TRACKING') {
    state.enabled = request.enabled;
    chrome.storage.local.set({ tracking_enabled: state.enabled });
    updateBadge();
    sendResponse({ success: true, enabled: state.enabled });
    return true;
  }

  if (request.type === 'SET_PROJECT') {
    state.activeProjectId = request.projectId;
    chrome.storage.local.set({ active_project_id: state.activeProjectId });
    sendResponse({ success: true, projectId: state.activeProjectId });
    return true;
  }

  if (request.type === 'PAGE_CONTENT') {
    if (sender.tab?.url) {
      reportActivity(sender.tab.url, sender.tab.title || '', request.content);
    }
    sendResponse({ received: true });
    return true;
  }
});
