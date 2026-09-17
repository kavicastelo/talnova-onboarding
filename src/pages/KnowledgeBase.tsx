import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
} from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/Dialog';
import {
  Search,
  Book,
  FileText,
  Shield,
  Users,
  HelpCircle,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Globe,
  Link as LinkIcon,
  Tag,
  MonitorPlay,
  CheckCircle2,
  Archive,
  ArrowLeft,
  Clock,
  Sparkles
} from 'lucide-react';
import {
  useKbCategories,
  useKbArticles,
  useCreateKbArticle,
  useUpdateKbArticle,
  useDeleteKbArticle,
  usePublishKbArticle,
  useArchiveKbArticle,
  useQuickLinks,
  useCreateQuickLink,
  useUpdateQuickLink,
  useDeleteQuickLink
} from '../hooks/useKnowledgeBase';
import {
  useKnowledgeGaps,
  useResolveGapWithQuickAnswer,
  useDismissGap,
  useTriggerReindex
} from '../hooks/useKnowledgeGaps';
import { Badge } from '../components/Badge';
import { useRole } from '../context/RoleContext';
import { toast } from 'sonner';
import { CATEGORY_MAP } from '../services/knowledgeBase.service';
import { useTranslation } from 'react-i18next';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

const iconMap: Record<string, React.ComponentType<any>> = {
  'Company Policies': Shield,
  'Employee Handbook': Book,
  'Engineering Guidelines': FileText,
  'HR & People': Users,
  'HelpCircle': HelpCircle,
  'Users': Users,
  'Book': Book,
  'Link': LinkIcon,
  'Globe': Globe
};

export function KnowledgeBase() {
  const navigate = useNavigate();
  const { role } = useRole();
  const { t } = useTranslation('kb');
  const hasToken = !!localStorage.getItem('auth_token');
  const isAdmin = hasToken && (role === 'admin' || role === 'owner');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  // Queries
  const { data: categories, isLoading: catLoading, isError: catError, refetch: refetchCats } = useKbCategories();
  const { data: articles, isLoading: artLoading, isError: artError, refetch: refetchArts } = useKbArticles({
    search,
    category: selectedCategory,
    status: isAdmin ? undefined : 'published'
  });

  const artPagination = usePagination({ data: articles || [], initialPageSize: 6 });
  const { data: quickLinks, isLoading: qlLoading, isError: qlError, refetch: refetchQls } = useQuickLinks();

  // Mutations
  const createArtMutation = useCreateKbArticle();
  const updateArtMutation = useUpdateKbArticle();
  const deleteArtMutation = useDeleteKbArticle();
  const publishArtMutation = usePublishKbArticle();
  const archiveArtMutation = useArchiveKbArticle();

  const createQlMutation = useCreateQuickLink();
  const updateQlMutation = useUpdateQuickLink();
  const deleteQlMutation = useDeleteQuickLink();

  // Selected Article for Reading / Editing
  const [activeArticle, setActiveArticle] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Article Form State
  const [artTitle, setArtTitle] = useState('');
  const [artSummary, setArtSummary] = useState('');
  const [artCategory, setArtCategory] = useState('Company Policies');
  const [artContent, setArtContent] = useState('');
  const [artTags, setArtTags] = useState('');

  // Quick Link Form Modal State
  const [isQlModalOpen, setIsQlModalOpen] = useState(false);
  const [editingQl, setEditingQl] = useState<any>(null);
  const [qlTitle, setQlTitle] = useState('');
  const [qlUrl, setQlUrl] = useState('');
  const [qlIcon, setQlIcon] = useState('Link');

  // Admin Knowledge Gaps State
  const [mainTab, setMainTab] = useState<'articles' | 'gaps'>('articles');
  const [gapFilter, setGapFilter] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');
  const [quickAnswerModalOpen, setQuickAnswerModalOpen] = useState(false);
  const [selectedGap, setSelectedGap] = useState<any>(null);
  const [quickAnswerText, setQuickAnswerText] = useState('');

  const { data: gapsData, isLoading: gapsLoading } = useKnowledgeGaps(
    gapFilter === 'all' ? undefined : gapFilter
  );
  const gaps = gapsData?.data || [];
  const unresolvedGapsCount = gaps.filter((g) => g.status === 'unresolved').length;

  const resolveQuickAnswerMutation = useResolveGapWithQuickAnswer();
  const dismissGapMutation = useDismissGap();
  const triggerReindexMutation = useTriggerReindex();

  const handleOpenQuickAnswer = (gap: any) => {
    setSelectedGap(gap);
    setQuickAnswerText(gap.resolutionNotes || '');
    setQuickAnswerModalOpen(true);
  };

  const handleSaveQuickAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGap || !quickAnswerText.trim()) return;
    await resolveQuickAnswerMutation.mutateAsync({
      gapId: selectedGap._id,
      answer: quickAnswerText.trim(),
    });
    setQuickAnswerModalOpen(false);
    setSelectedGap(null);
  };

  const handleCreateArticleFromGap = (gap: any) => {
    handleStartCreate();
    setArtTitle(gap.question);
    setArtSummary(`Company policy and guidance regarding: ${gap.question}`);
    setMainTab('articles');
  };

  const handleRetry = () => {
    refetchCats();
    refetchArts();
    refetchQls();
  };

  const handleOpenArticle = (article: any) => {
    setActiveArticle(article);
    setIsEditing(false);
    setIsCreating(false);
  };

  const { id: paramArticleId } = useParams();

  useEffect(() => {
    if (paramArticleId && articles && articles.length > 0) {
      const match = articles.find(
        (a: any) =>
          a.id === paramArticleId ||
          a.slug === paramArticleId ||
          a.title.toLowerCase().includes(paramArticleId.toLowerCase())
      );
      if (match) {
        handleOpenArticle(match);
      }
    }
  }, [paramArticleId, articles]);

  const handleStartCreate = () => {
    setArtTitle('');
    setArtSummary('');
    setArtCategory('Company Policies');
    setArtContent('');
    setArtTags('');
    setIsCreating(true);
    setIsEditing(false);
    setActiveArticle(null);
  };

  const handleStartEdit = (article: any) => {
    setArtTitle(article.title || '');
    setArtSummary(article.summary || '');
    setArtCategory(article.category || 'Company Policies');
    setArtContent(article.blocks?.map((b: any) => b.content).filter(Boolean).join('\n\n') || article.content || '');
    setArtTags(article.tags?.join(', ') || '');
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    const blocks = artContent.split('\n\n').map((content) => ({
      type: 'text',
      content: content.trim()
    })).filter((b) => b.content.length > 0);

    const tagsArray = artTags.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      if (isCreating) {
        await createArtMutation.mutateAsync({
          title: artTitle,
          summary: artSummary,
          category: artCategory,
          contentBlocks: blocks,
          tags: tagsArray
        });
        toast.success('Article created successfully as draft');
        setIsCreating(false);
      } else {
        await updateArtMutation.mutateAsync({
          id: activeArticle.id,
          data: {
            title: artTitle,
            summary: artSummary,
            category: artCategory,
            contentBlocks: blocks,
            tags: tagsArray
          }
        });
        toast.success('Article updated successfully');
        setIsEditing(false);
        setActiveArticle(null);
      }
    } catch (err) {
      toast.error('Failed to save article changes.');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this article?')) return;
    try {
      await deleteArtMutation.mutateAsync(id);
      toast.success('Article deleted successfully');
      setActiveArticle(null);
    } catch (err) {
      toast.error('Failed to delete article.');
    }
  };

  const handlePublishArticle = async (id: string) => {
    try {
      await publishArtMutation.mutateAsync(id);
      toast.success('Article published successfully!');
      setActiveArticle(null);
    } catch (err) {
      toast.error('Failed to publish article.');
    }
  };

  const handleArchiveArticle = async (id: string) => {
    try {
      await archiveArtMutation.mutateAsync(id);
      toast.success('Article archived successfully.');
      setActiveArticle(null);
    } catch (err) {
      toast.error('Failed to archive article.');
    }
  };

  // Quick Links CRUD
  const handleOpenQlModal = (ql?: any) => {
    if (ql) {
      setEditingQl(ql);
      setQlTitle(ql.title);
      setQlUrl(ql.url);
      setQlIcon(ql.icon || 'Link');
    } else {
      setEditingQl(null);
      setQlTitle('');
      setQlUrl('');
      setQlIcon('Link');
    }
    setIsQlModalOpen(true);
  };

  const handleSaveQl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qlTitle.trim() || !qlUrl.trim()) {
      toast.error('Title and URL are required');
      return;
    }

    try {
      if (editingQl) {
        await updateQlMutation.mutateAsync({
          id: editingQl.id,
          data: { title: qlTitle, url: qlUrl, icon: qlIcon }
        });
        toast.success('Quick Link updated');
      } else {
        await createQlMutation.mutateAsync({
          title: qlTitle,
          url: qlUrl,
          icon: qlIcon,
          order: (quickLinks?.length || 0) + 1
        });
        toast.success('Quick Link added');
      }
      setIsQlModalOpen(false);
    } catch (err) {
      toast.error('Failed to save Quick Link');
    }
  };

  const handleDeleteQl = async (id: string) => {
    if (!window.confirm('Delete this Quick Link?')) return;
    try {
      await deleteQlMutation.mutateAsync(id);
      toast.success('Quick Link deleted');
    } catch (err) {
      toast.error('Failed to delete Quick Link');
    }
  };

  if (catLoading || artLoading || qlLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (catError || artError || qlError) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Knowledge Base</h2>
        <p className="text-muted-foreground">An error occurred while communicating with the backend.</p>
        <Button onClick={handleRetry} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Detail / Create / Edit Overlay Reader */}
      {(activeArticle || isCreating || isEditing) && (
        <Card className="border-primary/20 bg-muted/20 backdrop-blur-md p-6 relative animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveArticle(null);
                setIsCreating(false);
                setIsEditing(false);
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
            </Button>

            <div className="flex items-center gap-2">
              {activeArticle && !isCreating && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/kb/slideshow')}
                  data-testid="slideshow-view-btn"
                  className="gap-1.5 border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                >
                  <MonitorPlay className="h-4 w-4" /> Slideshow View
                </Button>
              )}

              {/* Admin actions for detail view */}
              {activeArticle && isAdmin && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleStartEdit(activeArticle)}>
                    <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  {activeArticle.publishingStatus === 'draft' && (
                    <Button variant="default" size="sm" onClick={() => handlePublishArticle(activeArticle.id)}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Publish
                    </Button>
                  )}
                  {activeArticle.publishingStatus === 'published' && (
                    <Button variant="outline" size="sm" onClick={() => handleArchiveArticle(activeArticle.id)}>
                      <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteArticle(activeArticle.id)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isCreating || isEditing ? (
            <form onSubmit={handleSaveArticle} className="space-y-4 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold tracking-tight">
                {isCreating ? 'Create New Article' : 'Edit Article'}
              </h2>
              <div>
                <label className="text-sm font-semibold mb-1 block">Article Title</label>
                <Input
                  value={artTitle}
                  onChange={(e: any) => setArtTitle(e.target.value)}
                  placeholder="e.g. Code of Conduct"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Category</label>
                  <select
                    value={artCategory}
                    onChange={(e) => setArtCategory(e.target.value)}
                    className="w-full h-10 px-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.keys(CATEGORY_MAP).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Tags (comma-separated)</label>
                  <Input
                    value={artTags}
                    onChange={(e: any) => setArtTags(e.target.value)}
                    placeholder="e.g. handbook, legal, conduct"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Short Summary</label>
                <Input
                  value={artSummary}
                  onChange={(e: any) => setArtSummary(e.target.value)}
                  placeholder="Quick summary of this article..."
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Content (separate paragraphs with double line-breaks)</label>
                <textarea
                  value={artContent}
                  onChange={(e) => setArtContent(e.target.value)}
                  rows={8}
                  placeholder="Write details here..."
                  className="w-full p-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => { setIsCreating(false); setIsEditing(false); }}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <article data-testid="active-article-view" className="max-w-3xl mx-auto space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {activeArticle.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{activeArticle.readTime}</span>
                  {isAdmin && (
                    <span className={`text-xs px-2 py-0.5 rounded font-mono capitalize ${activeArticle.publishingStatus === 'published' ? 'bg-green-500/10 text-green-500' :
                        activeArticle.publishingStatus === 'archived' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-zinc-500/10 text-zinc-500'
                      }`}>
                      {activeArticle.publishingStatus}
                    </span>
                  )}
                </div>
                <h1 data-testid="active-article-title" className="text-3xl font-extrabold tracking-tight text-foreground">{activeArticle.title}</h1>
                {activeArticle.summary && (
                  <p className="text-muted-foreground text-lg italic leading-relaxed">{activeArticle.summary}</p>
                )}
              </div>
              <hr className="border-border" />
              <div data-testid="active-article-content" className="prose dark:prose-invert max-w-none text-foreground/90 space-y-4 whitespace-pre-line leading-relaxed">
                {activeArticle.content}
              </div>
              {activeArticle.tags && activeArticle.tags.length > 0 && (
                <div className="flex items-center gap-2 pt-4">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-1.5">
                    {activeArticle.tags.map((tag: string) => (
                      <span key={tag} className="text-xs bg-muted px-2.5 py-0.5 rounded text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )}
        </Card>
      )}

      {/* Main Listing View */}
      {!activeArticle && !isCreating && !isEditing && (
        <>
          {/* Header Title & Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
              <p className="text-muted-foreground mt-1">
                {t('subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/kb/slideshow')}
                className="gap-2 border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
              >
                <MonitorPlay className="h-4 w-4" /> Live Slideshow Mode
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    data-testid="reindex-knowledge-btn"
                    onClick={() => triggerReindexMutation.mutate()}
                    disabled={triggerReindexMutation.isPending}
                    className="gap-1.5"
                  >
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    {triggerReindexMutation.isPending ? 'Indexing...' : 'Re-Index Knowledge'}
                  </Button>
                  <Button onClick={handleStartCreate} className="gap-1.5">
                    <Plus className="h-4 w-4" /> New Article
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Admin Navigation Tabs */}
          {isAdmin && (
            <div className="flex items-center gap-2 border-b pb-2">
              <button
                onClick={() => setMainTab('articles')}
                data-testid="kb-tab-articles"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  mainTab === 'articles'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <Book className="h-4 w-4" /> Articles & Guidelines
              </button>
              <button
                onClick={() => setMainTab('gaps')}
                data-testid="kb-tab-gaps"
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  mainTab === 'gaps'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60'
                }`}
              >
                <AlertCircle className="h-4 w-4 text-amber-500" /> Knowledge Gaps
                {unresolvedGapsCount > 0 && (
                  <Badge className="ml-1 px-1.5 py-0.2 text-[10px] bg-amber-500 text-white hover:bg-amber-600">
                    {unresolvedGapsCount} missing
                  </Badge>
                )}
              </button>
            </div>
          )}

          {/* Knowledge Gaps Dashboard (Admin Only) */}
          {mainTab === 'gaps' && isAdmin ? (
            <div className="space-y-6" data-testid="knowledge-gaps-dashboard">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-card p-4 rounded-xl border">
                <div>
                  <h2 className="text-base font-bold text-foreground">Missing Company Information Requests</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Questions asked by team members that could not be verified in official company documentation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filter:</span>
                  {(['unresolved', 'resolved', 'all'] as const).map((filter) => (
                    <Button
                      key={filter}
                      size="sm"
                      variant={gapFilter === filter ? 'default' : 'outline'}
                      className="text-xs h-7 capitalize"
                      onClick={() => setGapFilter(filter)}
                    >
                      {filter}
                    </Button>
                  ))}
                </div>
              </div>

              {gapsLoading ? (
                <div className="flex justify-center p-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : gaps.length === 0 ? (
                <Card className="p-12 text-center border-dashed">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                  <h3 className="font-semibold text-base">No Knowledge Gaps Found</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    All employee questions asked to the AI Assistant have matched approved company documents, or existing gaps have been resolved.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {gaps.map((gap: any) => (
                    <Card key={gap._id} data-testid="knowledge-gap-card" className="p-4 border hover:border-border/80 transition-all">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-foreground">"{gap.question}"</span>
                            <Badge variant="outline" className="text-xs font-semibold bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
                              {gap.occurrenceCount}x asked
                            </Badge>
                            <Badge
                              className={`text-[10px] capitalize ${
                                gap.status === 'resolved'
                                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                  : gap.status === 'dismissed'
                                  ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              }`}
                            >
                              {gap.status}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Last asked: {new Date(gap.lastAskedAt || gap.updatedAt).toLocaleDateString()}
                            </span>
                            {gap.category && <span>Category: {gap.category}</span>}
                            {gap.requestedBy?.length > 0 && (
                              <span>Requesters: {gap.requestedBy.length} team member(s)</span>
                            )}
                          </div>

                          {gap.status === 'resolved' && gap.resolutionNotes && (
                            <div className="mt-2 text-xs p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-foreground">
                              <span className="font-semibold text-emerald-600 block mb-0.5">Approved Quick Answer:</span>
                              {gap.resolutionNotes}
                            </div>
                          )}
                        </div>

                        {gap.status === 'unresolved' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              data-testid="resolve-quick-answer-btn"
                              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                              onClick={() => handleOpenQuickAnswer(gap)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Quick Answer
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => handleCreateArticleFromGap(gap)}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" /> Full Article
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => dismissGapMutation.mutate(gap._id)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Search box & Category Pills */}
              <div className="space-y-4">
                <div className="relative max-w-xl">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                  <Input
                    data-testid="kb-search-input"
                    value={search}
                    onChange={(e: any) => setSearch(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    className="pl-12 h-12 text-base rounded-full bg-background border-muted-foreground/20"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory(undefined)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === undefined
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                  >
                    {t('categories')}
                  </button>
                  {(categories || []).map((cat) => (
                    <button
                      key={cat.title}
                      onClick={() => setSelectedCategory(cat.title)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.title
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                    >
                      {cat.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Content: Articles (Left) + Quick Links (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left 2 Cols: Articles List */}
                <div className="lg:col-span-2 space-y-4">
                  {articles && articles.length === 0 ? (
                    <div className="text-center p-12 border border-dashed rounded-xl space-y-3">
                      <HelpCircle className="h-10 w-10 text-muted-foreground mx-auto" />
                      <h3 className="font-semibold text-lg">{t('noArticlesFound')}</h3>
                      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        {t('noArticlesDesc')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {artPagination.paginatedData.map((article: any) => (
                          <Card
                            key={article.id}
                            data-testid="article-card"
                            onClick={() => handleOpenArticle(article)}
                            className="p-5 hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between group hover:shadow-sm"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {article.category}
                                </span>
                                {isAdmin && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono capitalize ${article.publishingStatus === 'published' ? 'bg-green-500/10 text-green-500' :
                                      article.publishingStatus === 'archived' ? 'bg-amber-500/10 text-amber-500' :
                                        'bg-zinc-500/10 text-zinc-500'
                                    }`}>
                                    {article.publishingStatus}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold text-base group-hover:text-primary transition-colors line-clamp-1">
                                {article.title}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {article.summary || article.content}
                              </p>
                            </div>
                            <div className="flex items-center justify-between pt-4 mt-2 border-t text-xs text-muted-foreground">
                              <span>{article.readTime}</span>
                              <span className="flex items-center text-primary font-medium group-hover:translate-x-1 transition-transform">
                                Read <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                              </span>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* Articles Pagination */}
                      {articles && articles.length > 6 && (
                        <div className="pt-4">
                          <SimplePagination
                            currentPage={artPagination.page}
                            totalPages={artPagination.totalPages}
                            totalItems={artPagination.totalItems}
                            onPageChange={artPagination.setPage}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Right Col: Quick Links */}
                <div className="space-y-4">
                  <Card className="border-border">
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-bold text-base">{t('quickLinks')}</h2>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleOpenQlModal()} className="h-8 gap-1 text-xs text-primary">
                            <Plus className="h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        {quickLinks && quickLinks.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-4">No quick links available.</div>
                        ) : (
                          quickLinks?.map((link: any) => {
                            const IconComponent = iconMap[link.icon] || LinkIcon;
                            return (
                              <div
                                key={link.id}
                                className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
                              >
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 text-xs font-medium text-foreground flex-1"
                                >
                                  <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                                    <IconComponent className="h-4 w-4" />
                                  </div>
                                  <span className="truncate">{link.title}</span>
                                </a>

                                {isAdmin && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenQlModal(link)} className="h-7 w-7">
                                      <Edit2 className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteQl(link.id)} className="h-7 w-7">
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Quick Answer Resolution Modal */}
      <Dialog open={quickAnswerModalOpen} onOpenChange={setQuickAnswerModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b bg-card">
            <DialogTitle className="text-base font-bold">Provide Quick Answer</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Resolving: <span className="font-semibold text-foreground">"{selectedGap?.question}"</span>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveQuickAnswer} className="p-5 space-y-4 text-xs">
            <div>
              <label className="text-xs font-semibold mb-1 block text-foreground">
                Authoritative Company Answer
              </label>
              <textarea
                data-testid="quick-answer-textarea"
                rows={4}
                value={quickAnswerText}
                onChange={(e) => setQuickAnswerText(e.target.value)}
                placeholder="Enter official policy or answer (e.g. Business casual dress code, or 20 days annual leave...)"
                className="w-full p-2.5 border rounded-lg bg-background text-foreground text-xs focus:ring-2 focus:ring-primary/40 focus:outline-none"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                This answer will be immediately indexed into the knowledge retrieval vector store so the AI Assistant can answer future questions accurately.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setQuickAnswerModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                data-testid="submit-quick-answer-btn"
                disabled={resolveQuickAnswerMutation.isPending || !quickAnswerText.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {resolveQuickAnswerMutation.isPending ? 'Publishing & Indexing...' : 'Publish & Train AI'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Link Editor Modal */}
      <Dialog open={isQlModalOpen} onOpenChange={setIsQlModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-card">
            <DialogTitle className="text-lg font-bold">
              {editingQl ? 'Edit Quick Link' : 'Add Quick Link'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Configure internal tools, support pages, or helpful links.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveQl} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto max-h-[calc(85vh-140px)]">
              <div>
                <label className="text-xs font-semibold mb-1 block text-foreground">Title</label>
                <Input
                  value={qlTitle}
                  onChange={(e: any) => setQlTitle(e.target.value)}
                  placeholder="e.g. IT Helpdesk"
                  className="bg-background border-border text-foreground text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block text-foreground">URL</label>
                <Input
                  value={qlUrl}
                  onChange={(e: any) => setQlUrl(e.target.value)}
                  placeholder="https://..."
                  className="bg-background border-border text-foreground text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block text-foreground">Icon Style</label>
                <select
                  value={qlIcon}
                  onChange={(e) => setQlIcon(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-xl bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="Link">Link icon</option>
                  <option value="HelpCircle">Question / Help</option>
                  <option value="Users">Users / Directory</option>
                  <option value="Book">Book / Library</option>
                  <option value="Globe">Web / Globe</option>
                </select>
              </div>
            </div>

            <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsQlModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Save Link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}