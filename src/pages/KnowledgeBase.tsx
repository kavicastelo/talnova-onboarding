import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription } from
'../components/Card';
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
  RefreshCw } from
'lucide-react';
import { useKbCategories, useKbArticles } from '../hooks/useKnowledgeBase';
import { Skeleton } from '../components/Skeleton';

const iconMap: Record<string, React.ComponentType<any>> = {
  'Company Policies': Shield,
  'Employee Handbook': Book,
  'Engineering Guidelines': FileText,
  'HR & People': Users,
};

export function KnowledgeBase() {
  const [search, setSearch] = useState('');
  const {
    data: categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
  } = useKbCategories();

  const {
    data: articles,
    isLoading: articlesLoading,
    isError: articlesError,
    refetch: refetchArticles,
  } = useKbArticles({ search });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleRetry = () => {
    refetchCategories();
    refetchArticles();
  };

  const isLoading = categoriesLoading || articlesLoading;
  const isError = categoriesError || articlesError;

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-6xl mx-auto animate-pulse">
        <div className="flex flex-col items-center text-center space-y-4 py-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-96" />
          <Skeleton className="h-12 w-[600px] rounded-full mt-4" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Knowledge Base</h2>
        <p className="text-muted-foreground">An error occurred while loading knowledge base resource listings.</p>
        <Button onClick={handleRetry} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col items-center text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold tracking-tight">How can we help?</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Search our internal knowledge base for policies, guidelines, and
          answers to common questions.
        </p>
        <div className="relative w-full max-w-2xl mt-4">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search for articles, policies, or topics..."
            className="pl-12 h-12 text-base rounded-full bg-background shadow-sm border-muted-foreground/20"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {(categories || []).map((category) => {
          const IconComponent = iconMap[category.title] || HelpCircle;
          return (
            <Card
              key={category.title}
              className="hover:border-primary/50 transition-colors cursor-pointer group">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <IconComponent className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{category.title}</CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {category.count} articles
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-8 md:grid-cols-3 pt-8">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {search ? 'Search Results' : 'Recently Viewed'}
          </h2>
          <div className="space-y-3">
            {!articles || articles.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                No articles found matching "{search}".
              </div>
            ) : (
              articles.map((article, i) => (
                <Card
                  key={i}
                  className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium">{article.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {article.category} • {article.readTime} read
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Quick Links</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 text-left transition-colors">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">IT Support Desk</span>
                </button>
                <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 text-left transition-colors">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Employee Directory</span>
                </button>
                <button className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 text-left transition-colors">
                  <Book className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Request Training</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}