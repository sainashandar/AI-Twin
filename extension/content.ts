// Chrome Extension Content Script for Continuity AI
// Privacy-first passive text extraction: Excludes all forms, inputs, passwords, and sensitive fields.

(function() {
  // If page contains password inputs or credit card fields, do not extract page body text
  const hasPasswordField = document.querySelector('input[type="password"]');
  const hasCreditCardField = document.querySelector('input[autocomplete*="cc-"], input[name*="card"]');

  if (hasPasswordField || hasCreditCardField) {
    // Highly sensitive authentication or checkout page: Skip all content extraction
    return;
  }

  // Extract meta description or introductory paragraph
  let snippet = '';
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
  if (metaDesc) {
    snippet = metaDesc.trim();
  } else {
    const mainEl = document.querySelector('main, article, #content, .content, body');
    if (mainEl) {
      // Pick the first few paragraphs
      const paragraphs = Array.from(mainEl.querySelectorAll('p'))
        .map(p => p.innerText.trim())
        .filter(t => t.length > 30)
        .slice(0, 3);

      snippet = paragraphs.join(' ');
    }
  }

  if (snippet.length > 0) {
    // Limit to 1000 characters
    const trimmed = snippet.slice(0, 1000);
    chrome.runtime.sendMessage({
      type: 'PAGE_CONTENT',
      content: trimmed
    }).catch(() => {
      // Background worker might be idle
    });
  }
})();
