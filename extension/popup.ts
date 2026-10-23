// Chrome Extension Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('status-badge')!;
  const currentUrlEl = document.getElementById('current-url')!;
  const toggleBtn = document.getElementById('toggle-tracking-btn')!;
  const exclusionNote = document.getElementById('exclusion-note')!;

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    currentUrlEl.textContent = tab.url.replace(/^https?:\/\//, '').slice(0, 36) + '...';
  } else {
    currentUrlEl.textContent = 'No active webpage';
  }

  // Get current state from background
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
    const isEnabled = res?.state?.enabled ?? true;
    updateUI(isEnabled);
  });

  toggleBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (res) => {
      const current = res?.state?.enabled ?? true;
      const target = !current;
      chrome.runtime.sendMessage({ type: 'TOGGLE_TRACKING', enabled: target }, () => {
        updateUI(target);
      });
    });
  });

  function updateUI(isEnabled: boolean) {
    if (isEnabled) {
      statusBadge.textContent = 'Active';
      statusBadge.className = 'status-badge status-active';
      toggleBtn.textContent = 'Pause Tracking';
      (toggleBtn as HTMLElement).style.background = '#f59e0b';
    } else {
      statusBadge.textContent = 'Paused';
      statusBadge.className = 'status-badge status-paused';
      toggleBtn.textContent = 'Resume Tracking';
      (toggleBtn as HTMLElement).style.background = '#10b981';
    }
  }
});
