import React, { useState, useEffect } from 'react';
import { PrivacySettings, ExcludedDomain } from '../../types';
import { 
  ShieldCheck, 
  Trash2, 
  Plus, 
  Download, 
  AlertTriangle, 
  Cpu, 
  Clock, 
  Lock,
  Globe
} from 'lucide-react';
import { api } from '../../services/api';

interface SettingsViewProps {
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onRefresh }) => {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [excludedDomains, setExcludedDomains] = useState<ExcludedDomain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data.privacy);
      setExcludedDomains(data.excludedDomains);
      setApiKeyInput(data.privacy?.ai_api_key || '');
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (updates: Partial<PrivacySettings>) => {
    setSaving(true);
    try {
      const updated = await api.updateSettings(updates);
      setSettings(updated);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;
    try {
      await api.addExcludedDomain(newDomain.trim(), newReason.trim() || undefined);
      setNewDomain('');
      setNewReason('');
      loadSettings();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDomain = async (id: string) => {
    await api.deleteExcludedDomain(id);
    loadSettings();
  };

  const handleExport = () => {
    api.exportData();
  };

  const handleWipeAll = async () => {
    if (confirm('CRITICAL ACTION: Are you sure you want to permanently delete all personal memories, browser records, notes, and tasks? This cannot be undone.')) {
      if (confirm('Please confirm a second time: Permanently clear all SQLite user data?')) {
        await api.wipeAllData();
        alert('All personal data has been wiped.');
        onRefresh();
      }
    }
  };

  if (!settings) {
    return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Privacy Guarantee Header */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/20 via-zinc-900 to-zinc-900 border border-emerald-500/30 flex items-center justify-between shadow-card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Local-First Privacy Architecture</h3>
          </div>
          <p className="text-xs text-zinc-400 max-w-xl">
            Continuity AI processes and stores browser context locally in your private SQLite database. Passwords, auth credentials, and financial portals are excluded automatically.
          </p>
        </div>
      </div>

      {/* Browser Activity Permissions */}
      <div className="p-5 rounded-xl bg-[#121215] border border-border space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Browser Activity Monitoring Controls</span>
        </h4>

        <div className="space-y-3 text-xs">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <div>
              <div className="font-semibold text-white">Browser Activity Tracking</div>
              <div className="text-zinc-400 text-[11px]">Allow capturing permitted tabs and grouping into sessions</div>
            </div>
            <input
              type="checkbox"
              checked={!!settings.tracking_enabled}
              onChange={(e) => handleUpdate({ tracking_enabled: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Browser-Wide Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <div>
              <div className="font-semibold text-white">Browser-Wide Tracking Consent</div>
              <div className="text-zinc-400 text-[11px]">Track all permitted browser tabs rather than only active workspace tabs</div>
            </div>
            <input
              type="checkbox"
              checked={!!settings.browser_wide_tracking}
              onChange={(e) => handleUpdate({ browser_wide_tracking: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-500 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Inactivity Threshold */}
          <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Session Inactivity Grouping Threshold</div>
                <div className="text-zinc-400 text-[11px]">Cluster idle tabs into a new session after this duration</div>
              </div>
              <span className="font-mono text-emerald-400 font-bold">{settings.session_idle_threshold_minutes} min</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="5"
              value={settings.session_idle_threshold_minutes}
              onChange={(e) => handleUpdate({ session_idle_threshold_minutes: parseInt(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Sensitive Domain Exclusions */}
      <div className="p-5 rounded-xl bg-[#121215] border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Sensitive-Site Exclusions ({excludedDomains.length})</span>
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              These domains are completely blocked from tracking and content extraction.
            </p>
          </div>
        </div>

        {/* Add Domain Form */}
        <form onSubmit={handleAddDomain} className="flex gap-2">
          <input
            type="text"
            placeholder="domain.com (e.g. chase.com, intranet.internal)"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-border rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-emerald-400 border border-zinc-700 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>
        </form>

        {/* Domain List */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {excludedDomains.map((d) => (
            <div
              key={d.id}
              className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs"
            >
              <div>
                <span className="font-mono text-zinc-200 font-semibold">{d.domain}</span>
                {d.reason && <span className="text-zinc-500 text-[11px] ml-2">&bull; {d.reason}</span>}
              </div>
              <button
                onClick={() => handleDeleteDomain(d.id)}
                className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AI Provider Configuration */}
      <div className="p-5 rounded-xl bg-[#121215] border border-border space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Engine & Provider Mode</span>
        </h4>

        <div className="space-y-2 text-xs">
          {[
            {
              id: 'mock',
              name: 'Local Deterministic Provider (Mock)',
              desc: 'Completely free, offline, instant response. Full support for all continuity summaries, prioritization, and follow-ups without API keys.'
            },
            {
              id: 'openai',
              name: 'OpenAI (GPT-4o-mini)',
              desc: 'Route completions through OpenAI API. Requires API key.'
            },
            {
              id: 'anthropic',
              name: 'Anthropic (Claude 3.5 Sonnet)',
              desc: 'Route completions through Anthropic Claude. Requires API key.'
            }
          ].map((prov) => (
            <label
              key={prov.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                settings.ai_provider === prov.id
                  ? 'bg-zinc-900 border-emerald-500/40 text-white'
                  : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <input
                type="radio"
                name="ai_provider"
                checked={settings.ai_provider === prov.id}
                onChange={() => handleUpdate({ ai_provider: prov.id })}
                className="mt-0.5 accent-emerald-500"
              />
              <div>
                <div className="font-semibold text-zinc-200">{prov.name}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">{prov.desc}</div>
              </div>
            </label>
          ))}
        </div>

        {settings.ai_provider !== 'mock' && (
          <div className="pt-2 text-xs">
            <label className="text-zinc-400 block mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-border rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleUpdate({ ai_api_key: apiKeyInput })}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg"
              >
                Save Key
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Export & Deletion */}
      <div className="p-5 rounded-xl bg-[#121215] border border-border space-y-4">
        <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
          <Download className="w-3.5 h-3.5 text-zinc-400" />
          <span>Data Ownership, Export & Erasure</span>
        </h4>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            onClick={handleExport}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Personal Data (JSON)</span>
          </button>

          <button
            onClick={handleWipeAll}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-950/40 hover:bg-red-950/70 text-red-400 text-xs font-semibold border border-red-500/40 transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All Saved Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
