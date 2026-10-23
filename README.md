# Continuity AI — Personal Continuity Agent

> **"Your AI remembers where you left off, knows what matters next, and helps you follow through."**

Continuity AI is a privacy-first, local-first personal continuity agent. It solves context fragmentation by remembering meaningful progress across browser activity, organizing unstructured thoughts into actionable projects, intelligently prioritizing next actions, and preparing contextual follow-ups that execute **only with explicit human approval**.

---

## 1. System Architecture

Continuity AI uses a local-first hybrid architecture:

- **Frontend (`client/`)**: Built with React 18, TypeScript, Vite, and Tailwind CSS with a dark productivity aesthetic. Provides 7 core views:
  1. **Today / Briefing**: Daily greeting, "Resume where I left off" context pack, priority next action with focus duration selector (30/60/90m), pending follow-ups.
  2. **Memory Timeline**: Chronological work sessions, extracted decisions, blockers, next steps, and verified source links.
  3. **Projects & Goals**: Strategic objectives, task dependency graphs, and progress indicators.
  4. **AI Notebook**: Quick capture for unstructured thoughts with AI structural breakdown (goals, milestones, tasks, checklists) and explicit user acceptance.
  5. **Follow-through**: Pipeline view (`IN_REVIEW`, `APPROVED`, `SCHEDULED`, `SENT`, `COMPLETED`), approval inspector, SHA-256 hash immutability safeguard, duplicate-send prevention, and incoming reply simulator.
  6. **AI Assistant**: Conversational retrieval grounded in SQLite FTS5 episodic and project memory, complete with source citations and uncertainty acknowledgment.
  7. **Settings & Privacy**: Browser monitoring toggles, sensitive domain exclusions, AI provider modes, JSON export, and complete memory wipe.
  8. **In-App Browser Simulator**: Built-in tab activity and prompt safety simulator to test permitted activity, sensitive exclusions, and prompt injection defenses immediately without manual setup.
- **Local Engine (`server/`)**: Express + TypeScript backend running on `localhost:3001` with native SQLite (`better-sqlite3`) and FTS5 full-text search. Manages session clustering, prompt injection sanitization, priority scoring, follow-up scheduler, and real-time Server-Sent Events (SSE).
- **Chrome Extension (`extension/`)**: Manifest V3 extension with service worker, content script, options page, and popup. Enforces permission boundaries, per-tab tracking toggles, sensitive domain filtering, and safe passive text extraction.

---

## 2. Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)

### Installation
Clone or navigate to the repository directory and install dependencies:

```bash
npm install
```

### Running Locally

To start both the local engine (port 3001) and web dashboard (port 5173) concurrently:

```bash
npm run dev
```

Or run them individually:
```bash
# Terminal 1: Start backend engine
npm run dev:server

# Terminal 2: Start web dashboard
npm run dev:client
```

- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **Local Engine API**: [http://localhost:3001/api](http://localhost:3001/api)
- **Engine Health Check**: [http://localhost:3001/health](http://localhost:3001/health)

---

## 3. Chrome Extension Setup (Manifest V3)

The extension is pre-built in the `extension/` directory.

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` directory inside this project:
   `/Users/saina/Desktop/AI Continuity/extension`
5. The **Continuity AI Companion** icon will appear in your Chrome toolbar.
6. Click the extension icon to view tracking status, pause/resume monitoring, or jump straight to the web dashboard.

*Note: You can also rebuild the extension at any time via:*
```bash
npm run build:extension
```

---

## 4. Running the Automated Test Suite

Continuity AI includes automated tests covering all 16 items specified in Section 15 of the specification:

```bash
npm test
```

### Verified Test Cases:
- Sensitive domain exclusion (financial portals, authentication providers)
- Sensitive pattern detection in URLs (`/login`, `/auth`, `/password`)
- Prompt injection defense & threat neutralization in untrusted page text
- Passive content extraction without inspecting credentials
- Inactivity-based session clustering and episodic memory persistence
- Persistent SQLite FTS5 lexical BM25 search
- Grounded conversational Q&A with evidence citations
- Deterministic multi-factor priority scoring and dependency penalties
- Unstructured note capture with AI structural transformation
- Strict approval state machine progression (`SCHEDULED` -> `IN_REVIEW` -> `APPROVED` -> `SENDING` -> `SENT`)
- **Critical Security Invariant**: Material edit of approved draft immediately invalidates approval
- **Duplicate Send Prevention**: Rejects duplicate send when message is in-flight or already sent

---

## 5. Security & Privacy Guarantees

1. **Local-First Processing**: Raw activity records, full-text search indexes, notes, and task graphs remain on your local device in SQLite.
2. **Untrusted Page Content Boundary**: Text extracted from webpages is wrapped in XML data boundary tags and scanned for prompt injection directives (instruction overrides, exfiltration triggers, role hijacking).
3. **Sensitive Domains Excluded by Default**: Financial institutions (`chase.com`, `bankofamerica.com`, `paypal.com`) and password vaults (`1password.com`, `bitwarden.com`) are automatically excluded.
4. **Approval Immutability**: When you grant approval to an email draft, a SHA-256 fingerprint is recorded. Any subsequent modification immediately drops the draft back to `IN_REVIEW`.
5. **No Autonomous External Actions**: The system is architecturally incapable of transmitting messages without an explicit human confirmation gesture.

---

## 6. AI Provider Modes

Configure AI providers via **Settings & Privacy** or `.env`:
- **Mock Local Deterministic AI (Default)**: Fully functional, 0 cost, 0 API keys required. Produces deterministic session summaries, task breakdowns, priority explanations, follow-up drafts, and grounded answers.
- **OpenAI (GPT-4o / GPT-4o-mini)**: Hosted model support when `OPENAI_API_KEY` is provided.
- **Anthropic (Claude 3.5 Sonnet)**: Hosted model support when `ANTHROPIC_API_KEY` is provided.
- **Ollama Local**: Route completions locally through `http://localhost:11434`.

---

## 7. Feature Checklist

| Feature | Status | Notes |
|---|:---:|---|
| **Phase 1: Local Foundation** | Completed | SQLite schema, relational tables, migrations, seed data, Vite+React+Tailwind UI |
| **Phase 2: Browser Activity** | Completed | Inactivity clustering, sensitive site exclusions, prompt injection sanitizer, Chrome MV3 extension, In-app simulator |
| **Phase 3: Persistent Memory** | Completed | 6 memory types, FTS5 BM25 search, grounded Q&A with source citations |
| **Phase 4: Notebook & Priority** | Completed | Unstructured quick capture, AI structural breakdown, transparent priority scoring |
| **Phase 5: Follow-through Agent** | Completed | Approval state machine, SHA-256 immutability gate, duplicate protection, simulated provider & reply simulator |
| **Phase 6: Daily Briefing** | Completed | "Resume where I left off", urgent follow-ups, blockers, active projects |
| **Data Ownership** | Completed | Full JSON export and complete data wipe |

---

## 8. Current Limitations & Assumptions

- **Local Machine Hosting**: In MVP mode, the local engine runs on `localhost:3001`. Cloud synchronization across multiple computers is left for future releases.
- **Email Sending**: By default, uses the simulated provider with delivery confirmation and audit logging. Real Gmail OAuth or SMTP can be configured in settings.
- **Browser Compatibility**: The browser extension is packaged for Google Chrome and Chromium browsers (Brave, Edge) supporting Manifest V3.
