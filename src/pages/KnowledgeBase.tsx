import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
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
  Eye,
  Globe,
  Link as LinkIcon,
  Tag,
  MonitorPlay,
  CheckCircle2,
  Archive,
  ArrowLeft
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
import { useRole } from '../context/RoleContext';
import { toast } from 'sonner';
import { CATEGORY_MAP } from '../services/knowledgeBase.service';

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
            <article className="max-w-3xl mx-auto space-y-6">
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
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{activeArticle.title}</h1>
                {activeArticle.summary && (
                  <p className="text-muted-foreground text-lg italic leading-relaxed">{activeArticle.summary}</p>
                )}
              </div>
              <hr className="border-border" />
              <div className="prose dark:prose-invert max-w-none text-foreground/90 space-y-4 whitespace-pre-line leading-relaxed">
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
              <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
              <p className="text-muted-foreground mt-1">
                Access reference guides, guidelines, and corporate information.
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
                <Button onClick={handleStartCreate} className="gap-1.5">
                  <Plus className="h-4 w-4" /> New Article
                </Button>
              )}
            </div>
          </div>

          {/* Search box & Category Pills */}
          <div className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e: any) => setSearch(e.target.value)}
                placeholder="Search articles, policies..."
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
                All Categories
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
                  {cat.title} ({cat.count})
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-3 pt-4">
            {/* Articles List */}
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-xl font-bold tracking-tight">Articles</h2>
              <div className="space-y-3">
                {!articles || articles.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
                    No articles found matching filters.
                  </div>
                ) : (
                  articles.map((article: any) => (
                    <Card
                      key={article.id}
                      onClick={() => handleOpenArticle(article)}
                      className="hover:bg-muted/40 hover:border-primary/30 transition-all duration-200 cursor-pointer group"
                    >
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{article.title}</h3>
                              {isAdmin && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono capitalize ${article.publishingStatus === 'published' ? 'bg-green-500/10 text-green-500' :
                                    article.publishingStatus === 'archived' ? 'bg-amber-500/10 text-amber-500' :
                                      'bg-zinc-500/10 text-zinc-500'
                                  }`}>
                                  {article.publishingStatus}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {article.category} • {article.readTime} • {article.views} views
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-1" />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Quick Links Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Quick Links</h2>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => handleOpenQlModal()}>
                    <Plus className="h-4 w-4 text-primary" />
                  </Button>
                )}
              </div>
              <Card className="border shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {!quickLinks || quickLinks.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        No links configured.
                      </div>
                    ) : (
                      quickLinks.map((link) => {
                        const IconComp = iconMap[link.icon] || LinkIcon;
                        return (
                          <div
                            key={link.id}
                            className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                          >
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              <IconComp className="h-5 w-5 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                              <span className="font-medium text-foreground hover:text-primary transition-colors">
                                {link.title}
                              </span>
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

      {/* Quick Link Editor Modal */}
      {isQlModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-md bg-zinc-900 border border-zinc-800 text-white">
            <CardHeader>
              <CardTitle className="text-xl">
                {editingQl ? 'Edit Quick Link' : 'Add Quick Link'}
              </CardTitle>
              <CardDescription>
                Configure internal tools, support pages, or helpful links.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSaveQl}>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Title</label>
                  <Input
                    value={qlTitle}
                    onChange={(e: any) => setQlTitle(e.target.value)}
                    placeholder="e.g. IT Helpdesk"
                    className="bg-zinc-950 border-zinc-800 text-zinc-200"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">URL</label>
                  <Input
                    value={qlUrl}
                    onChange={(e: any) => setQlUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-zinc-950 border-zinc-800 text-zinc-200"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Icon Style</label>
                  <select
                    value={qlIcon}
                    onChange={(e) => setQlIcon(e.target.value)}
                    className="w-full h-10 px-3 border border-zinc-800 rounded-md bg-zinc-950 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="Link">Link icon</option>
                    <option value="HelpCircle">Question / Help</option>
                    <option value="Users">Users / Directory</option>
                    <option value="Book">Book / Library</option>
                    <option value="Globe">Web / Globe</option>
                  </select>
                </div>
              </CardContent>
              <div className="flex justify-end gap-2 p-6 pt-0">
                <Button variant="outline" type="button" onClick={() => setIsQlModalOpen(false)} className="border-zinc-800 text-zinc-400 hover:text-white">
                  Cancel
                </Button>
                <Button type="submit">
                  Save Link
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}