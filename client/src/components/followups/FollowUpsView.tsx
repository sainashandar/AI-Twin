import React, { useState } from 'react';
import { FollowUp, FollowUpState } from '../../types';
import { 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  RotateCcw, 
  History,
  Mail,
  UserCheck,
  Ban,
  MessageSquare
} from 'lucide-react';
import { api } from '../../services/api';

interface FollowUpsViewProps {
  followUps: FollowUp[];
  onRefresh: () => void;
  selectedFollowUpForReview?: FollowUp | null;
  onClearReviewSelection?: () => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  followUps,
  onRefresh,
  selectedFollowUpForReview,
  onClearReviewSelection
}) => {
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [reviewModalItem, setReviewModalItem] = useState<FollowUp | null>(selectedFollowUpForReview || null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editRecipient, setEditRecipient] = useState('');
  const [hasEdited, setHasEdited] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [simReplyEmail, setSimReplyEmail] = useState('marcus.vance@apexfinancial.demo');
  const [simReplyText, setSimReplyText] = useState('Thanks for checking in Alex. The Section 4 specifications look great! Let us proceed.');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // When props pass selected item
  React.useEffect(() => {
    if (selectedFollowUpForReview) {
      openReviewModal(selectedFollowUpForReview);
    }
  }, [selectedFollowUpForReview]);

  const openReviewModal = async (item: FollowUp) => {
    setReviewModalItem(item);
    setEditSubject(item.subject);
    setEditBody(item.current_body);
    setEditRecipient(item.recipient);
    setHasEdited(false);
    setActionMessage(null);
    try {
      const audit = await api.getAuditLog(item.id);
      setAuditLog(audit);
    } catch (e) {
      // Ignore
    }
  };

  const closeReviewModal = () => {
    setReviewModalItem(null);
    if (onClearReviewSelection) onClearReviewSelection();
  };

  const handleDraftChange = async () => {
    if (!reviewModalItem) return;
    setIsProcessing(true);
    try {
      const updated = await api.updateDraft(reviewModalItem.id, {
        subject: editSubject,
        body: editBody,
        recipient: editRecipient
      });
      setReviewModalItem(updated);
      setHasEdited(false);
      setActionMessage('Draft updated. Note: Approval was reset to IN_REVIEW for security.');
      const audit = await api.getAuditLog(reviewModalItem.id);
      setAuditLog(audit);
      onRefresh();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async () => {
    if (!reviewModalItem) return;
    setIsProcessing(true);
    try {
      const updated = await api.approveFollowUp(reviewModalItem.id);
      setReviewModalItem(updated);
      setActionMessage('Draft approved! The cryptographic fingerprint is locked and ready for send execution.');
      const audit = await api.getAuditLog(reviewModalItem.id);
      setAuditLog(audit);
      onRefresh();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSend = async () => {
    if (!reviewModalItem) return;
    setIsProcessing(true);
    try {
      const res = await api.sendFollowUp(reviewModalItem.id);
      if (res.success) {
        setReviewModalItem(res.item);
        setActionMessage('Message dispatched successfully! Confirmed in execution audit log.');
        const audit = await api.getAuditLog(reviewModalItem.id);
        setAuditLog(audit);
        onRefresh();
      } else {
        setActionMessage(`Send failed: ${res.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Send blocked by safeguard: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateReply = async () => {
    setIsProcessing(true);
    try {
      const res = await api.simulateReply(simReplyEmail, simReplyText);
      alert(`Simulation result: ${res.message} (${res.matchedFollowUps} follow-ups resolved to COMPLETED)`);
      onRefresh();
      if (reviewModalItem) {
        const refreshed = await api.getFollowUps();
        const current = refreshed.find(f => f.id === reviewModalItem.id);
        if (current) setReviewModalItem(current);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = followUps.filter((item) => {
    if (activeTab === 'ALL') return true;
    return item.state === activeTab;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* State Machine Overview Banner */}
      <div className="p-5 rounded-xl bg-[#121215] border border-border shadow-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Strict Human-in-the-Loop Approval State Machine</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Continuity AI prepares context-rich drafts from your commitments, but NEVER sends without explicit human authorization.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 self-start sm:self-auto font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SHA256 Immutability Gate</span>
          </div>
        </div>

        {/* State Flow Visualizer */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 text-[10px] font-mono border-t border-border/80">
          {[
            'SCHEDULED',
            'DUE',
            'CONTEXT_CHECK',
            'DRAFT_READY',
            'IN_REVIEW',
            'APPROVED',
            'SENDING',
            'SENT'
          ].map((st, idx, arr) => (
            <React.Fragment key={st}>
              <span
                className={`px-2 py-0.5 rounded font-semibold ${
                  st === 'IN_REVIEW'
                    ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                    : st === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : st === 'SENT'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {st}
              </span>
              {idx < arr.length - 1 && <span className="text-zinc-600">&rarr;</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filter Tabs & Incoming Reply Test Banner */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* State Tabs */}
        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
          {['ALL', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'SENT', 'COMPLETED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Simulated Incoming Reply Trigger (For Condition Testing) */}
        <button
          onClick={handleSimulateReply}
          disabled={isProcessing}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium flex items-center gap-1.5 transition-colors self-start md:self-auto"
          title="Simulate receiving Marcus Vance's email to test conditional auto-resolution"
        >
          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
          <span>Simulate Recipient Reply</span>
        </button>
      </div>

      {/* Follow-up Cards */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#121215] border border-border border-dashed text-xs text-zinc-500">
          No follow-ups found in category "{activeTab}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isReview = item.state === 'IN_REVIEW';
            const isApproved = item.state === 'APPROVED';
            const isSent = item.state === 'SENT';
            const isCompleted = item.state === 'COMPLETED';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-xl border transition-all ${
                  isReview
                    ? 'bg-[#181216] border-pink-500/40 shadow-subtle'
                    : isApproved
                    ? 'bg-[#101815] border-emerald-500/40 shadow-subtle'
                    : 'bg-[#121215] border-border'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                      {item.recipient}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                      isReview
                        ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                        : isApproved
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isSent
                        ? 'bg-blue-500/20 text-blue-400'
                        : isCompleted
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.state}
                  </span>
                </div>

                {/* Subject & Body */}
                <h4 className="text-xs font-semibold text-zinc-200 mb-1 line-clamp-1">{item.subject}</h4>
                <p className="text-[11px] text-zinc-400 line-clamp-3 mb-3 italic">
                  "{item.current_body}"
                </p>

                {/* Context Condition Check */}
                {item.context_check_result && (
                  <div className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-300 mb-3">
                    <span className="text-zinc-500 font-semibold block mb-0.5">Automated Context Verification:</span>
                    <span>{item.context_check_result}</span>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-border/80 text-xs">
                  <span className="text-[10px] text-zinc-500">
                    Due: {new Date(item.due_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <button
                    onClick={() => openReviewModal(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isReview
                        ? 'bg-pink-500 hover:bg-pink-600 text-white'
                        : isApproved
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-black'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    {isReview ? 'Review & Authorize' : isApproved ? 'Execute Send &rarr;' : 'Inspect Details'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Draft Review & Approval Gate Modal */}
      {reviewModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#121215] border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-elevated">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Follow-through Authorization Gate & Inspector
                </h3>
              </div>
              <button
                onClick={closeReviewModal}
                className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded bg-zinc-800"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Status Alert Banner */}
              {actionMessage && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-xs">
                  {actionMessage}
                </div>
              )}

              {/* State Status Banner */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                <div>
                  <span className="text-[11px] text-zinc-400 block">Current Approval State:</span>
                  <span className="text-sm font-bold text-white uppercase font-mono">
                    {reviewModalItem.state}
                  </span>
                </div>

                {reviewModalItem.approved_content_hash && (
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500 block">Approved Content Hash (SHA-256):</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {reviewModalItem.approved_content_hash.slice(0, 16)}...
                    </span>
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Recipient</label>
                  <input
                    type="text"
                    value={editRecipient}
                    onChange={(e) => {
                      setEditRecipient(e.target.value);
                      setHasEdited(true);
                    }}
                    className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-lg text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Subject</label>
                  <input
                    type="text"
                    value={editSubject}
                    onChange={(e) => {
                      setEditSubject(e.target.value);
                      setHasEdited(true);
                    }}
                    className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-zinc-400">Draft Message Content</label>
                    {hasEdited && (
                      <span className="text-[10px] text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Unsaved edits detected
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={7}
                    value={editBody}
                    onChange={(e) => {
                      setEditBody(e.target.value);
                      setHasEdited(true);
                    }}
                    className="w-full px-3 py-2 bg-zinc-900 border border-border rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans resize-none"
                  />
                </div>

                {/* Material Change Warning */}
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed">
                  <span className="font-semibold block mb-0.5">Safety Invariant:</span>
                  Modifying the draft after approval automatically invalidates prior approval, requiring a fresh explicit approval gesture before transmission.
                </div>

                {/* Edit Save Button */}
                {hasEdited && (
                  <button
                    onClick={handleDraftChange}
                    disabled={isProcessing}
                    className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium text-xs transition-colors"
                  >
                    Save Modifications & Reset to IN_REVIEW
                  </button>
                )}
              </div>

              {/* Action Buttons: Explicit Approval & Explicit Send */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-3 border-t border-border">
                {/* 1. Explicit Approval Gate */}
                <button
                  onClick={handleApprove}
                  disabled={isProcessing || reviewModalItem.state === 'APPROVED' || reviewModalItem.state === 'SENT'}
                  className={`flex-1 w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    reviewModalItem.state === 'APPROVED'
                      ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-black'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {reviewModalItem.state === 'APPROVED' ? 'Approved & Locked' : 'Grant Explicit Approval'}
                  </span>
                </button>

                {/* 2. Final Send Gate */}
                <button
                  onClick={handleExecuteSend}
                  disabled={isProcessing || reviewModalItem.state !== 'APPROVED'}
                  className={`flex-1 w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    reviewModalItem.state === 'APPROVED'
                      ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-subtle'
                      : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Confirm & Send Now</span>
                </button>
              </div>

              {/* Immutable Approval Audit Trail */}
              {auditLog.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Immutable Audit Log ({auditLog.length} events)</span>
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto font-mono text-[10px]">
                    {auditLog.map((log) => (
                      <div key={log.id} className="p-2 rounded bg-zinc-900/60 border border-zinc-800 text-zinc-300">
                        <div className="flex items-center justify-between text-zinc-500 mb-0.5">
                          <span>{log.previous_state} &rarr; {log.new_state} (actor: {log.actor})</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        </div>
                        {log.reason && <div className="text-zinc-400">{log.reason}</div>}
                        {log.content_hash && <div className="text-emerald-500">Hash: {log.content_hash.slice(0, 20)}...</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
