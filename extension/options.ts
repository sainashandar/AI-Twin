// Chrome Extension Options Script

document.addEventListener('DOMContentLoaded', () => {
  const serverInput = document.getElementById('server-url') as HTMLInputElement;
  const saveBtn = document.getElementById('save-server-btn')!;

  chrome.storage.local.get(['server_url'], (res) => {
    if (res.server_url) {
      serverInput.value = res.server_url;
    }
  });

  saveBtn.addEventListener('click', () => {
    const val = serverInput.value.trim() || 'http://localhost:3001';
    chrome.storage.local.set({ server_url: val }, () => {
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.textContent = 'Save Endpoint';
      }, 1500);
    });
  });
});
