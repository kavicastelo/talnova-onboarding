import React from 'react';
import {
  Search,
  Mail,
  MessageSquare,
  X,
  Layers,
} from 'lucide-react';
import {
  ICommThread,
  CommChannel,
  CommThreadStatus,
  InboxCounters,
} from '../../../../services/salesInbox.service';

interface ThreadListPaneProps {
  threads: ICommThread[];
  selectedThreadId: string | null;
  onSelectThread: (thread: ICommThread) => void;
  channelFilter?: CommChannel;
  onChangeChannelFilter: (channel?: CommChannel) => void;
  statusFilter?: CommThreadStatus;
  onChangeStatusFilter: (status?: CommThreadStatus) => void;
  unreadOnly: boolean;
  onToggleUnreadOnly: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  counters: InboxCounters;
  isLoading?: boolean;
}

export const ThreadListPane: React.FC<ThreadListPaneProps> = ({
  threads,
  selectedThreadId,
  onSelectThread,
  channelFilter,
  onChangeChannelFilter,
  statusFilter,
  onChangeStatusFilter,
  unreadOnly,
  onToggleUnreadOnly,
  searchQuery,
  onSearchChange,
  counters,
  isLoading = false,
}) => {
  const formatTimeElapsed = (dateInput: string | Date) => {
    try {
      const now = new Date().getTime();
      const time = new Date(dateInput).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d`;
      return new Date(dateInput).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div
      id="inbox-thread-list-pane"
      className="w-full md:w-80 lg:w-96 shrink-0 border-r border-border bg-card/40 flex flex-col h-full overflow-hidden"
    >
      {/* Search & Header */}
      <div className="p-3 border-b border-border/80 space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            id="inbox-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations, contacts, leads..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-background/90 border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-normal"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Channel Filter Pills */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            id="filter-channel-all"
            onClick={() => onChangeChannelFilter(undefined)}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
              channelFilter === undefined
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All ({counters.total})
          </button>
          <button
            type="button"
            id="filter-channel-email"
            onClick={() => onChangeChannelFilter(channelFilter === 'email' ? undefined : 'email')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
              channelFilter === 'email'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Mail className="w-3 h-3" />
            <span>Email</span>
          </button>
          <button
            type="button"
            id="filter-channel-whatsapp"
            onClick={() =>
              onChangeChannelFilter(channelFilter === 'whatsapp' ? undefined : 'whatsapp')
            }
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium transition-all ${
              channelFilter === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-muted/80 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <MessageSquare className="w-3 h-3" />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* Status Tabs and Unread filter */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="filter-status-open"
              onClick={() => onChangeStatusFilter(statusFilter === 'open' ? undefined : 'open')}
              className={`pb-1 border-b-2 font-medium transition-all text-xs ${
                statusFilter === 'open' || statusFilter === undefined
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Open ({counters.open + counters.pending})
            </button>
            <button
              type="button"
              id="filter-status-resolved"
              onClick={() =>
                onChangeStatusFilter(statusFilter === 'resolved' ? undefined : 'resolved')
              }
              className={`pb-1 border-b-2 font-medium transition-all text-xs ${
                statusFilter === 'resolved'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Resolved ({counters.resolved})
            </button>
          </div>

          {/* Unread Only Toggle */}
          <button
            type="button"
            id="filter-unread-toggle"
            onClick={onToggleUnreadOnly}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
              unreadOnly
                ? 'bg-blue-500/10 text-blue-500 border-blue-500/30'
                : 'text-muted-foreground border-transparent hover:bg-muted/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                unreadOnly ? 'bg-blue-500' : 'bg-muted-foreground/40'
              }`}
            />
            <span>Unread ({counters.unread})</span>
          </button>
        </div>
      </div>

      {/* Threads List */}
      <div id="inbox-threads-list" className="flex-1 overflow-y-auto divide-y divide-border/40">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-xs space-y-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading conversations...</p>
          </div>
        ) : threads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs space-y-2">
            <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
              <Layers className="w-5 h-5" />
            </div>
            <p className="font-semibold text-foreground">No conversations found</p>
            <p className="text-[11px]">
              {searchQuery || channelFilter || unreadOnly
                ? 'Try broadening your search or resetting channel filters.'
                : 'Inbound replies to outreach campaigns and direct messages will stream here automatically.'}
            </p>
          </div>
        ) : (
          threads.map((thread) => {
            const isSelected = thread._id === selectedThreadId;
            const contact = thread.contactId;
            const lead = thread.leadId;
            const company = thread.companyId;

            const name =
              contact?.fullName ||
              (contact?.firstName && `${contact.firstName} ${contact.lastName}`) ||
              lead?.fullName ||
              (lead?.firstName && `${lead.firstName} ${lead.lastName}`) ||
              thread.messages.find((m) => m.direction === 'inbound')?.from ||
              'Inbound Contact';

            const org = company?.name || lead?.companyName || '';
            const isUnread = thread.messages.some(
              (m) => m.direction === 'inbound' && m.status !== 'read'
            );

            return (
              <div
                key={thread._id}
                id={`thread-item-${thread._id}`}
                onClick={() => onSelectThread(thread)}
                className={`p-3.5 cursor-pointer transition-all border-l-4 ${
                  isSelected
                    ? 'bg-primary/10 border-l-primary shadow-inner'
                    : isUnread
                    ? 'border-l-blue-500 bg-background/80 hover:bg-muted/50'
                    : 'border-l-transparent hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-xs text-foreground truncate">{name}</span>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Unread" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {formatTimeElapsed(thread.lastMessageAt)}
                  </span>
                </div>

                {org && (
                  <div className="text-[11px] text-muted-foreground truncate mb-1">{org}</div>
                )}

                <div className="flex items-center gap-1.5 mb-1.5">
                  {thread.channel === 'email' ? (
                    <Mail className="w-3 h-3 text-blue-500 shrink-0" />
                  ) : (
                    <MessageSquare className="w-3 h-3 text-emerald-500 shrink-0" />
                  )}
                  <span className="text-xs font-medium text-foreground truncate">
                    {thread.subject || 'Direct message thread'}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {thread.lastMessageSnippet ||
                    thread.messages[thread.messages.length - 1]?.body ||
                    'No preview snippet'}
                </p>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/20 text-[10px] text-muted-foreground">
                  <span
                    className={`capitalize px-1.5 py-0.2 rounded font-medium ${
                      thread.status === 'resolved'
                        ? 'bg-muted text-muted-foreground'
                        : thread.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {thread.status}
                  </span>
                  <span>{thread.messages.length} msg{thread.messages.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ThreadListPane;
