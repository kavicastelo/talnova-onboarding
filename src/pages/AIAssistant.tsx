import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import {
  Bot,
  User,
  Send,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  ArrowRight,
  Plus,
  MessageSquare,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import {
  useAIChat,
  useAIConversations,
  useAIConversationById,
  useAIFeedback
} from '../hooks/useAIAssistant';
import { toast } from 'sonner';

export function AIAssistant() {
  const navigate = useNavigate();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [inputPrompt, setInputPrompt] = useState('');

  const { data: conversations, isLoading: isConversationsLoading } = useAIConversations();
  const { data: activeThread } = useAIConversationById(activeConversationId);

  const chatMutation = useAIChat();
  const feedbackMutation = useAIFeedback();

  const currentMessages = activeThread?.messages || [];

  const handleSendPrompt = (promptText?: string) => {
    const textToSend = promptText || inputPrompt;
    if (!textToSend.trim()) return;

    setInputPrompt('');

    chatMutation.mutate(
      {
        message: textToSend,
        conversationId: activeConversationId,
      },
      {
        onSuccess: (updatedThread) => {
          if (!activeConversationId) {
            setActiveConversationId(updatedThread._id);
          }
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to generate AI response');
        },
      }
    );
  };

  const handleFeedback = (messageId: string, rating: 'up' | 'down') => {
    if (!activeConversationId) return;

    feedbackMutation.mutate(
      {
        conversationId: activeConversationId,
        messageId,
        rating,
      },
      {
        onSuccess: () => {
          toast.success('Thank you for rating this response!');
        },
      }
    );
  };

  const handleNewChat = () => {
    setActiveConversationId(undefined);
    setInputPrompt('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="h-7 w-7 text-indigo-600" />
            AI Onboarding Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tenant-safe AI assistant answering onboarding questions using authorized company knowledge base articles.
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleNewChat}>
          <Plus className="h-4 w-4 mr-2" /> New Conversation Thread
        </Button>
      </div>

      {/* Main Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[680px]">
        {/* Left History Sidebar */}
        <Card className="lg:col-span-1 flex flex-col overflow-hidden">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chat History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 flex-1 overflow-y-auto space-y-1">
            {isConversationsLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (conversations || []).length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center">No previous conversations.</div>
            ) : (
              conversations?.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => setActiveConversationId(conv._id)}
                  className={`w-full text-left p-3 rounded-md text-xs transition-colors flex items-center gap-2 ${
                    activeConversationId === conv._id
                      ? 'bg-indigo-600/10 text-indigo-600 font-semibold border border-indigo-600/20'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right Chat Area */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden border shadow-sm">
          {/* Message Thread Body */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50 dark:bg-background">
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto py-12">
                <div className="p-4 bg-indigo-600/10 rounded-full text-indigo-600">
                  <Sparkles className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">How can I assist your onboarding today?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ask about company policies, required documents, or assigned learning journeys.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full pt-2">
                  <button
                    onClick={() => handleSendPrompt('What company policies do I need to read?')}
                    className="p-3 bg-card border rounded-lg text-xs text-left hover:border-indigo-600 transition-colors flex justify-between items-center"
                  >
                    <span>What company policies do I need to read?</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleSendPrompt('Who is my assigned onboarding buddy?')}
                    className="p-3 bg-card border rounded-lg text-xs text-left hover:border-indigo-600 transition-colors flex justify-between items-center"
                  >
                    <span>Who is my assigned onboarding buddy?</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleSendPrompt('How do I complete my pending tasks?')}
                    className="p-3 bg-card border rounded-lg text-xs text-left hover:border-indigo-600 transition-colors flex justify-between items-center"
                  >
                    <span>How do I complete my pending tasks?</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ) : (
              currentMessages.map((msg, idx) => (
                <div
                  key={msg._id || idx}
                  className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'assistant' && (
                    <div className="p-2 bg-indigo-600 text-white rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-xl p-4 rounded-xl space-y-3 ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-card border text-foreground rounded-bl-none shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {/* Citations / References */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-border/40 space-y-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground block flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-indigo-600" /> Source Citations:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.citations.map((c, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => navigate(c.url)}
                              className="text-[11px] bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/20"
                            >
                              📖 {c.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Suggestions */}
                    {msg.actionSuggestions && msg.actionSuggestions.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {msg.actionSuggestions.map((a, aIdx) => (
                          <Button
                            key={aIdx}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 bg-background"
                            onClick={() => navigate(a.action)}
                          >
                            {a.text} <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Response Feedback Buttons */}
                    {msg.sender === 'assistant' && msg._id && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleFeedback(msg._id!, 'up')}
                          className="text-muted-foreground hover:text-emerald-600 transition-colors p-1"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg._id!, 'down')}
                          className="text-muted-foreground hover:text-red-600 transition-colors p-1"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full h-8 w-8 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {chatMutation.isPending && (
              <div className="flex gap-3 text-xs justify-start items-center">
                <div className="p-2 bg-indigo-600 text-white rounded-full h-8 w-8 flex items-center justify-center">
                  <Bot className="h-4 w-4 animate-bounce" />
                </div>
                <div className="bg-card border p-3 rounded-xl text-muted-foreground animate-pulse">
                  Synthesizing company knowledge response...
                </div>
              </div>
            )}
          </div>

          {/* Input Box Bar */}
          <div className="p-4 border-t bg-card flex gap-2 items-center">
            <Input
              placeholder="Ask AI Onboarding Assistant a question..."
              value={inputPrompt}
              onChange={(e: any) => setInputPrompt(e.target.value)}
              onKeyDown={(e: any) => e.key === 'Enter' && handleSendPrompt()}
              className="flex-1"
            />
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => handleSendPrompt()}
              disabled={chatMutation.isPending || !inputPrompt.trim()}
            >
              <Send className="h-4 w-4 mr-2" /> Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AIAssistant;
