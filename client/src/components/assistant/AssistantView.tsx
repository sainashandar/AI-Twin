import React, { useState } from 'react';
import { Bot, Send, Sparkles, Compass, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  sources?: Array<{
    id: string;
    type: string;
    title: string;
    url?: string | null;
    contentSnippet: string;
  }>;
  provider?: string;
  timestamp: string;
}

const SAMPLE_QUESTIONS = [
  'What was I working on yesterday?',
  'Where did I leave off?',
  'What did I decide about this project?',
  'What should I work on next?',
  'What commitments do I have coming up?'
];

export const AssistantView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello Alex! I am your Continuity AI agent. I maintain persistent memory across your permitted browser work sessions, active projects, goals, notes, and commitments.\n\nAsk me where you left off, what decisions you made, or what you should focus on next. Every answer is grounded directly in your verified local memory.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (queryText?: string) => {
    const q = queryText || input;
    if (!q.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.askAssistant(q.trim());
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        sources: res.sources,
        provider: res.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: `Error retrieving memory: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4 h-[calc(100vh-6rem)] flex flex-col justify-between">
      {/* Sample Query Chips */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {SAMPLE_QUESTIONS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            disabled={loading}
            className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isUser
                    ? 'bg-emerald-500 text-black'
                    : 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                }`}
              >
                {isUser ? 'ME' : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-white'
                    : 'bg-[#121215] border border-border text-zinc-200 shadow-card'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Grounded Memory Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/80 text-[11px]">
                    <span className="text-zinc-500 font-semibold block mb-1.5">
                      Grounding Evidence & Citations:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <div
                          key={i}
                          className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-1.5 font-mono text-[10px]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="font-semibold text-emerald-400 uppercase">
                            [{src.type}]
                          </span>
                          <span className="truncate max-w-[150px]">{src.title}</span>
                          {src.url && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-zinc-500 hover:text-white"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2">
                  <span>{msg.timestamp}</span>
                  {msg.provider && <span>{msg.provider}</span>}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 text-emerald-400 border border-zinc-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3 rounded-xl bg-[#121215] border border-border text-xs text-zinc-400">
              Retrieving persistent memory and grounding answer...
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-2 border-t border-border/60 shrink-0"
      >
        <input
          type="text"
          placeholder="Ask Continuity AI anything about your past work, decisions, or commitments..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-3 bg-[#121215] border border-border rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-subtle"
        >
          <Send className="w-3.5 h-3.5 fill-black" />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
