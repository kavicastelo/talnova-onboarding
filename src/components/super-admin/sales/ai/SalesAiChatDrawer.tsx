import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Trash2,
  Database,
  AlertCircle,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { ChatMessage, salesAiService } from '../../../../services/salesAi.service';

interface SalesAiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAiConfigured?: boolean;
}

const DEFAULT_PROMPT_CHIPS = [
  'Which deals haven\'t progressed this month?',
  'Summarize leads from healthcare industry',
  'What is our current at-risk pipeline value?',
  'What objections are stalling deals in Proposal?',
];

export const SalesAiChatDrawer: React.FC<SalesAiChatDrawerProps> = ({
  isOpen,
  onClose,
  isAiConfigured = true,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI Sales Intelligence Co-Pilot. I have direct real-time access to your deals, leads, stage velocity, and risk flags. What would you like to analyze today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isLoading) return;

    setErrorMessage(null);
    const userMessage: ChatMessage = {
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await salesAiService.chatWithSalesData(prompt, messages);
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.reply,
        provider: response.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errText =
        err.response?.data?.message ||
        err.message ||
        'Failed to query Sales AI assistant. Please check your credentials in Sales Integrations.';
      setErrorMessage(errText);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation cleared. How can I assist with your pipeline analysis?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setErrorMessage(null);
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      id="sales-ai-chat-drawer"
      className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border/60 flex items-center justify-between shrink-0 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-primary flex items-center justify-center border border-primary/30 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Sales Data AI Assistant</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Live CRM
                </span>
              </h2>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Database className="w-3 h-3 text-emerald-500" />
                <span>Grounded on real-time deals & pipeline data</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear conversation"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close drawer"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              aria-label="Close assistant drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Offline notice if AI is not configured */}
        {!isAiConfigured && (
          <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>AI Provider credentials are offline. Chat responses are operating in simulated fallback mode.</span>
          </div>
        )}

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={index}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-[11px] ${
                    isUser
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-foreground border-border'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                <div
                  className={`relative max-w-[85%] rounded-2xl p-3.5 shadow-sm space-y-1 ${
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-tr-xs'
                      : 'bg-muted/40 border border-border/60 text-foreground rounded-tl-xs'
                  }`}
                >
                  <div className="leading-relaxed whitespace-pre-wrap font-normal">{msg.content}</div>

                  <div className="flex items-center justify-between gap-3 pt-1 text-[10px] opacity-75">
                    <span>{msg.timestamp}</span>
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, index)}
                        className="hover:opacity-100 transition-opacity flex items-center gap-1"
                        title="Copy answer"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0 border border-border">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 rounded-tl-xs flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Analyzing pipeline telemetry and generating response...</span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Chips */}
        <div className="px-4 py-2 border-t border-border/40 bg-muted/10 shrink-0">
          <div className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1.5">
            Suggested Sales Inquiries
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {DEFAULT_PROMPT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                disabled={isLoading}
                className="whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/60 transition-all shrink-0 hover:border-primary/40"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border/60 shrink-0 bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              id="sales-ai-chat-input"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Ask about pipeline health, stuck deals, leads..."
              disabled={isLoading}
              className="flex-1 px-3.5 py-2 rounded-xl text-xs bg-muted/40 border border-border focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
            />

            <button
              type="submit"
              id="sales-ai-chat-submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm"
              aria-label="Send query"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SalesAiChatDrawer;
