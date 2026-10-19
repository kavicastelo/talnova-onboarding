import React, { useState, useEffect } from 'react';
import {
  Inbox,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ICommThread,
  CommChannel,
  CommThreadStatus,
  InboxCounters,
  SendReplyPayload,
  salesInboxService,
} from '../../../../services/salesInbox.service';
import ThreadListPane from './ThreadListPane';
import MessageStreamPane from './MessageStreamPane';
import LeadContextSidebar from './LeadContextSidebar';

interface UnifiedInboxLayoutProps {
  initialThreadId?: string | null;
}

export const UnifiedInboxLayout: React.FC<UnifiedInboxLayoutProps> = ({ initialThreadId }) => {
  const navigate = useNavigate();

  const [threads, setThreads] = useState<ICommThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ICommThread | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId || null);

  const [channelFilter, setChannelFilter] = useState<CommChannel | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<CommThreadStatus | undefined>(undefined);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [counters, setCounters] = useState<InboxCounters>({
    total: 0,
    open: 0,
    pending: 0,
    resolved: 0,
    unread: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingThread, setIsRefreshingThread] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load threads list
  const loadThreads = async (preserveSelected = true) => {
    try {
      setIsLoading(true);
      const res = await salesInboxService.listThreads({
        channel: channelFilter,
        status: statusFilter,
        unreadOnly: unreadOnly ? true : undefined,
        search: searchQuery.trim() || undefined,
        limit: 50,
      });

      setThreads(res.items);
      setCounters(res.counters);

      // Resolve selected thread
      if (res.items.length > 0) {
        if (preserveSelected && selectedThreadId) {
          const found = res.items.find((t) => t._id === selectedThreadId);
          if (found) {
            loadSingleThread(found._id);
          } else {
            loadSingleThread(res.items[0]._id);
          }
        } else {
          loadSingleThread(res.items[0]._id);
        }
      } else {
        setSelectedThread(null);
        setSelectedThreadId(null);
      }
    } catch (err) {
      console.error('Failed to load inbox threads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load single thread with full message history and mark as read
  const loadSingleThread = async (id: string, markRead = false) => {
    try {
      setIsRefreshingThread(true);
      const thread = await salesInboxService.getThreadById(id, { markAsRead: markRead });
      setSelectedThread(thread);
      setSelectedThreadId(thread._id);

      // If marked read, update thread in list
      if (markRead) {
        setThreads((prev) =>
          prev.map((t) => (t._id === id ? { ...t, messages: thread.messages } : t))
        );
      }
    } catch (err) {
      console.error(`Failed to load thread ${id}:`, err);
    } finally {
      setIsRefreshingThread(false);
    }
  };

  // Debounced search / filter reload
  useEffect(() => {
    const timer = setTimeout(() => {
      loadThreads(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [channelFilter, statusFilter, unreadOnly, searchQuery]);

  // Handle user selecting a thread
  const handleSelectThread = (thread: ICommThread) => {
    setSelectedThreadId(thread._id);
    loadSingleThread(thread._id, true);
  };

  // Handle sending reply
  const handleSendReply = async (payload: SendReplyPayload) => {
    if (!selectedThread) return;

    const updatedThread = await salesInboxService.sendReply(selectedThread._id, payload);
    setSelectedThread(updatedThread);

    // Refresh threads list snippet and timestamp
    setThreads((prev) =>
      prev.map((t) =>
        t._id === updatedThread._id
          ? {
              ...t,
              status: updatedThread.status,
              lastMessageSnippet: updatedThread.lastMessageSnippet,
              lastMessageAt: updatedThread.lastMessageAt,
              messages: updatedThread.messages,
            }
          : t
      )
    );
  };

  // Handle updating status
  const handleUpdateStatus = async (newStatus: CommThreadStatus) => {
    if (!selectedThread) return;

    const updated = await salesInboxService.updateThread(selectedThread._id, { status: newStatus });
    setSelectedThread(updated);

    // Update in list
    setThreads((prev) =>
      prev.map((t) => (t._id === updated._id ? { ...t, status: updated.status } : t))
    );

    // Reload counters
    loadThreads(true);
  };

  // Handle manual mark read
  const handleMarkRead = async () => {
    if (!selectedThread) return;

    const updated = await salesInboxService.markThreadRead(selectedThread._id);
    setSelectedThread(updated);

    setThreads((prev) =>
      prev.map((t) => (t._id === updated._id ? { ...t, messages: updated.messages } : t))
    );
    setCounters((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
  };

  return (
    <div
      id="unified-inbox-container"
      className="flex flex-1 h-[calc(100vh-8.5rem)] rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm"
    >
      {/* 1. Left Pane: Thread List */}
      <ThreadListPane
        threads={threads}
        selectedThreadId={selectedThreadId}
        onSelectThread={handleSelectThread}
        channelFilter={channelFilter}
        onChangeChannelFilter={setChannelFilter}
        statusFilter={statusFilter}
        onChangeStatusFilter={setStatusFilter}
        unreadOnly={unreadOnly}
        onToggleUnreadOnly={() => setUnreadOnly(!unreadOnly)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        counters={counters}
        isLoading={isLoading}
      />

      {/* 2. Center Pane: Message Stream or Empty Selection */}
      {selectedThread ? (
        <MessageStreamPane
          thread={selectedThread}
          onSendReply={handleSendReply}
          onUpdateStatus={handleUpdateStatus}
          onMarkRead={handleMarkRead}
          onRefresh={() => loadSingleThread(selectedThread._id)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isRefreshing={isRefreshingThread}
        />
      ) : (
        <div
          id="inbox-empty-selection"
          className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">
            {threads.length === 0 ? 'No Conversations Yet' : 'Select a Conversation'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
            {threads.length === 0
              ? 'Connect your Amazon SES or Meta WhatsApp integrations and launch outreach campaigns to start streaming real-time replies here.'
              : 'Choose a thread from the left pane to inspect message history, review client metadata, and compose replies.'}
          </p>

          {threads.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                id="inbox-goto-campaigns-btn"
                onClick={() => navigate('/super-admin/sales/campaigns/new')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Launch Outreach Campaign</span>
              </button>
              <button
                type="button"
                id="inbox-goto-integrations-btn"
                onClick={() => navigate('/super-admin/sales/campaigns')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60 transition-all"
              >
                <span>View All Campaigns</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Right Pane: Customer 360 Context Sidebar */}
      {selectedThread && (
        <LeadContextSidebar
          thread={selectedThread}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      )}
    </div>
  );
};

export default UnifiedInboxLayout;
