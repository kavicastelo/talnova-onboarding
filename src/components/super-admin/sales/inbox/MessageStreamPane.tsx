import React, { useRef, useEffect } from 'react';
import {
  Mail,
  MessageSquare,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  PanelRightClose,
  PanelRightOpen,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  ICommThread,
  ICommMessage,
  CommThreadStatus,
  SendReplyPayload,
} from '../../../../services/salesInbox.service';
import MessageComposer from './MessageComposer';

interface MessageStreamPaneProps {
  thread: ICommThread;
  onSendReply: (payload: SendReplyPayload) => Promise<void>;
  onUpdateStatus: (status: CommThreadStatus) => Promise<void>;
  onMarkRead: () => Promise<void>;
  onRefresh: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isRefreshing?: boolean;
}

export const MessageStreamPane: React.FC<MessageStreamPaneProps> = ({
  thread,
  onSendReply,
  onUpdateStatus,
  onMarkRead,
  onRefresh,
  isSidebarOpen,
  onToggleSidebar,
  isRefreshing = false,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages?.length]);

  const lead = thread.leadId;
  const contact = thread.contactId;
  const company = thread.companyId;

  const counterpartyName =
    contact?.fullName ||
    (contact?.firstName && `${contact.firstName} ${contact.lastName}`) ||
    lead?.fullName ||
    (lead?.firstName && `${lead.firstName} ${lead.lastName}`) ||
    thread.messages.find((m) => m.direction === 'inbound')?.from ||
    'Client Conversation';

  const counterpartyCompany = company?.name || lead?.companyName || 'Independent';

  const formatMessageTime = (dateInput: string | Date) => {
    try {
      const d = new Date(dateInput);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatMessageDate = (dateInput: string | Date) => {
    try {
      const d = new Date(dateInput);
      return d.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
      });
    } catch {
      return '';
    }
  };

  const getStatusIcon = (status: ICommMessage['status']) => {
    switch (status) {
      case 'read':
        return (
          <span title="Read">
            <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
          </span>
        );
      case 'delivered':
        return (
          <span title="Delivered">
            <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
        );
      case 'sent':
        return (
          <span title="Sent">
            <Check className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
        );
      case 'failed':
        return (
          <span title="Failed">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          </span>
        );
      default:
        return (
          <span title="Pending">
            <Clock className="w-3 h-3 text-muted-foreground" />
          </span>
        );
    }
  };

  const hasUnreadInbound = thread.messages.some(
    (m) => m.direction === 'inbound' && m.status !== 'read'
  );

  return (
    <div
      id="inbox-message-stream-pane"
      className="flex-1 flex flex-col h-full bg-background min-w-0 overflow-hidden"
    >
      {/* Thread Stream Header */}
      <div className="h-16 px-4 border-b border-border/80 flex items-center justify-between bg-card/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
            {counterpartyName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-foreground truncate">{counterpartyName}</h2>
              {thread.channel === 'email' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Mail className="w-3 h-3" /> Email
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <MessageSquare className="w-3 h-3" /> WhatsApp
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{counterpartyCompany}</p>
          </div>
        </div>

        {/* Actions & Status Dropdown */}
        <div className="flex items-center gap-2">
          {hasUnreadInbound && (
            <button
              id="mark-thread-read-btn"
              type="button"
              onClick={onMarkRead}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/60 transition-colors"
              title="Mark all messages as read"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden md:inline">Mark Read</span>
            </button>
          )}

          <button
            type="button"
            id="refresh-thread-btn"
            onClick={onRefresh}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            title="Refresh Conversation"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Thread Status Switcher */}
          <select
            id="thread-status-select"
            value={thread.status}
            onChange={(e) => onUpdateStatus(e.target.value as CommThreadStatus)}
            className="text-xs font-semibold rounded-md border border-input bg-background px-2.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary capitalize"
          >
            <option value="open">🟢 Open</option>
            <option value="pending">🟡 Pending</option>
            <option value="resolved">⚪ Resolved</option>
          </select>

          {/* Toggle Customer 360 sidebar */}
          <button
            type="button"
            id="toggle-sidebar-btn"
            onClick={onToggleSidebar}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors ml-1"
            title={isSidebarOpen ? 'Hide Context' : 'Show Context'}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Message History Feed */}
      <div
        id="messages-scroll-container"
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10"
      >
        {thread.subject && (
          <div className="text-center py-2 px-4 rounded-xl bg-card/60 border border-border/60 max-w-md mx-auto shadow-sm">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Topic:
            </span>
            <p className="text-xs font-medium text-foreground truncate mt-0.5">{thread.subject}</p>
          </div>
        )}

        {thread.messages.map((msg, index) => {
          const isInbound = msg.direction === 'inbound';
          const prevMsg = thread.messages[index - 1];
          const isDifferentDate =
            !prevMsg ||
            formatMessageDate(prevMsg.sentAt) !== formatMessageDate(msg.sentAt);

          return (
            <React.Fragment key={msg._id || index}>
              {isDifferentDate && (
                <div className="flex items-center justify-center my-3">
                  <span className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground bg-muted/80 rounded-full border border-border/40">
                    {formatMessageDate(msg.sentAt)}
                  </span>
                </div>
              )}

              <div
                className={`flex gap-2.5 ${isInbound ? 'justify-start' : 'justify-end'} group`}
              >
                {isInbound && (
                  <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                    {counterpartyName.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div
                  className={`max-w-[78%] md:max-w-[65%] rounded-2xl p-3.5 shadow-sm text-sm relative transition-all ${
                    isInbound
                      ? 'bg-card border border-border/70 text-card-foreground rounded-tl-sm'
                      : 'bg-primary text-primary-foreground rounded-tr-sm'
                  }`}
                >
                  {/* Sender / recipient header */}
                  <div className="flex items-center justify-between gap-3 text-[11px] mb-1.5 opacity-80">
                    <span className="font-semibold">
                      {isInbound ? counterpartyName : msg.metadata?.sentByName || 'Super Admin'}
                    </span>
                    <span className="text-[10px] whitespace-nowrap">
                      {formatMessageTime(msg.sentAt)}
                    </span>
                  </div>

                  {/* Optional Subject for Email messages */}
                  {msg.subject && msg.subject !== thread.subject && (
                    <div className="text-xs font-semibold mb-1 pb-1 border-b border-current/20">
                      {msg.subject}
                    </div>
                  )}

                  {/* Body text with whitespace preservation */}
                  <div className="whitespace-pre-wrap break-words leading-relaxed text-xs md:text-sm">
                    {msg.body}
                  </div>

                  {/* Delivery status footer for outbound messages */}
                  {!isInbound && (
                    <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-90">
                      <span className="capitalize">{msg.status}</span>
                      {getStatusIcon(msg.status)}
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Pinned Reply Composer */}
      <MessageComposer
        thread={thread}
        onSend={onSendReply}
        disabled={thread.status === 'resolved'}
      />
    </div>
  );
};

export default MessageStreamPane;
