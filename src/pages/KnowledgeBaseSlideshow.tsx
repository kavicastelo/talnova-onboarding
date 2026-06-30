import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKbArticles } from '../hooks/useKnowledgeBase';
import { Button } from '../components/Button';
import { Card, CardContent } from '../components/Card';
import { 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Maximize2, 
  Minimize2, 
  RefreshCw,
  Clock,
  BookOpen
} from 'lucide-react';

export function KnowledgeBaseSlideshow() {
  const navigate = useNavigate();
  const { data: articles = [], isLoading, isError } = useKbArticles({ status: 'published' });
  
  const [selectedArticleIndex, setSelectedArticleIndex] = useState<number>(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [intervalMs, setIntervalMs] = useState<number>(5000); // default 5 seconds
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<any>(null);

  const selectedArticle = articles[selectedArticleIndex];

  // Generate slides for the selected article
  const slides = React.useMemo(() => {
    if (!selectedArticle) return [];
    
    // First slide is Title & Summary
    const list: any[] = [
      {
        type: 'title',
        title: selectedArticle.title,
        category: selectedArticle.category,
        summary: selectedArticle.summary || 'Internal Knowledge Base Resource Guide',
      }
    ];

    // Followed by each content block
    if (selectedArticle.blocks && selectedArticle.blocks.length > 0) {
      selectedArticle.blocks.forEach((block: any) => {
        list.push({
          type: 'content',
          contentType: block.type,
          content: block.content,
          embedUrl: block.embedUrl
        });
      });
    } else if (selectedArticle.content) {
      // Fallback if no blocks
      selectedArticle.content.split('\n\n').forEach((para: string) => {
        if (para.trim()) {
          list.push({
            type: 'content',
            contentType: 'text',
            content: para.trim()
          });
        }
      });
    }

    return list;
  }, [selectedArticle]);

  // Handle slide transitions and autoplay progress
  useEffect(() => {
    if (!isPlaying || slides.length === 0) {
      setProgress(0);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    let elapsed = 0;
    
    progressIntervalRef.current = setInterval(() => {
      elapsed += stepMs;
      const pct = Math.min((elapsed / intervalMs) * 100, 100);
      setProgress(pct);

      if (elapsed >= intervalMs) {
        elapsed = 0;
        // Advance to next slide
        setCurrentSlideIndex((prev) => {
          if (prev < slides.length - 1) {
            return prev + 1;
          } else {
            // End of slides for this article, move to next article
            setSelectedArticleIndex((prevArticleIdx) => {
              const nextArticleIdx = (prevArticleIdx + 1) % articles.length;
              return nextArticleIdx;
            });
            return 0; // Reset slide index for next article
          }
        });
      }
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, intervalMs, slides.length, articles.length]);

  // Reset slide index when changing articles manually
  const handleSelectArticle = (index: number) => {
    setSelectedArticleIndex(index);
    setCurrentSlideIndex(0);
    setProgress(0);
  };

  const handleNext = () => {
    setProgress(0);
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      setSelectedArticleIndex((prevArticleIdx) => (prevArticleIdx + 1) % articles.length);
      setCurrentSlideIndex(0);
    }
  };

  const handlePrev = () => {
    setProgress(0);
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    } else {
      // Go to previous article's last slide
      const prevArticleIdx = selectedArticleIndex > 0 ? selectedArticleIndex - 1 : articles.length - 1;
      setSelectedArticleIndex(prevArticleIdx);
      // We will set slide index to 0 or we could map it, but 0 is simpler
      setCurrentSlideIndex(0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error("Fullscreen request failed", err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <RefreshCw className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-zinc-400 text-sm">Preparing Presentation Slides...</p>
      </div>
    );
  }

  if (isError || articles.length === 0) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center">
        <BookOpen className="h-16 w-16 text-zinc-600 mb-4" />
        <h2 className="text-2xl font-bold">No Slides Available</h2>
        <p className="text-zinc-400 max-w-md mt-2">
          There are no published articles in the Knowledge Base to display in the presentation view.
        </p>
        <Button onClick={() => navigate('/kb')} className="mt-6">
          Back to Knowledge Base
        </Button>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  return (
    <div 
      ref={containerRef}
      className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none"
    >
      {/* Top Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/90 px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          <span className="text-sm font-semibold tracking-wider uppercase text-zinc-400">
            Talnova Digital Display Board
          </span>
        </div>

        {/* Article Selector Dropdown */}
        <div className="flex items-center gap-4">
          <select 
            value={selectedArticleIndex}
            onChange={(e) => handleSelectArticle(Number(e.target.value))}
            className="bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {articles.map((art: any, i: number) => (
              <option key={art.id} value={i}>
                [{art.category}] {art.title}
              </option>
            ))}
          </select>

          {/* Slide speed selector */}
          <div className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-md border border-zinc-700">
            <Clock className="h-4 w-4 text-zinc-400" />
            <select 
              value={intervalMs}
              onChange={(e) => {
                setIntervalMs(Number(e.target.value));
                setProgress(0);
              }}
              className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
              <option value={8000}>8s</option>
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
            </select>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleFullscreen}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/kb')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
            title="Exit Slideshow"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-zinc-800 shrink-0">
        <div 
          className="h-full bg-indigo-500 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main Presentation Area */}
      <div className="flex-1 flex items-center justify-center p-8 relative bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
        
        {/* Navigation - Left Arrow */}
        <button 
          onClick={handlePrev}
          className="absolute left-6 w-14 h-14 rounded-full flex items-center justify-center bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all hover:scale-105 z-10"
        >
          <ChevronLeft className="h-8 w-8" />
        </button>

        {/* Slide Frame */}
        <div className="w-full max-w-5xl aspect-[16/9] flex items-center justify-center">
          <Card className="w-full h-full border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-2xl relative flex flex-col justify-center px-16 py-12">
            
            {/* Background branding accent */}
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500/80 rounded-l-lg" />
            
            <CardContent className="flex flex-col justify-center items-center h-full text-center p-0">
              
              {currentSlide?.type === 'title' ? (
                // Slide 0: Title Cover
                <div className="space-y-6 animate-fade-in max-w-3xl">
                  <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-500/20">
                    {currentSlide.category}
                  </span>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                    {currentSlide.title}
                  </h1>
                  <div className="h-1 w-24 bg-indigo-500/40 mx-auto" />
                  <p className="text-lg md:text-xl text-zinc-400 font-light leading-relaxed">
                    {currentSlide.summary}
                  </p>
                </div>
              ) : (
                // Slides 1..N: Content
                <div className="space-y-6 animate-fade-in max-w-3xl w-full">
                  <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">
                    {selectedArticle?.title}
                  </span>

                  {currentSlide?.contentType === 'callout' ? (
                    <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/10 p-8 text-left">
                      <p className="text-xl md:text-2xl text-indigo-200 font-medium leading-relaxed italic">
                        "{currentSlide.content}"
                      </p>
                    </div>
                  ) : currentSlide?.contentType === 'code' ? (
                    <pre className="rounded-lg bg-zinc-950 p-6 text-left border border-zinc-800 overflow-x-auto font-mono text-sm text-green-400">
                      <code>{currentSlide.content}</code>
                    </pre>
                  ) : currentSlide?.contentType === 'image' ? (
                    <div className="space-y-4">
                      <img 
                        src={currentSlide.embedUrl || '/placeholder.png'} 
                        alt="Slide Asset" 
                        className="max-h-[350px] mx-auto rounded-lg border border-zinc-800 object-contain shadow-lg"
                      />
                      {currentSlide.content && (
                        <p className="text-lg text-zinc-300 font-light leading-relaxed">
                          {currentSlide.content}
                        </p>
                      )}
                    </div>
                  ) : (
                    // Regular Text/Markdown block
                    <p className="text-2xl md:text-3xl text-zinc-200 font-light leading-relaxed tracking-wide text-center whitespace-pre-line">
                      {currentSlide?.content}
                    </p>
                  )}
                </div>
              )}
            </CardContent>

            {/* Slide counter */}
            <div className="absolute bottom-6 right-8 text-xs font-mono text-zinc-500">
              Slide {currentSlideIndex + 1} of {slides.length}
            </div>
            
            <div className="absolute bottom-6 left-8 text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              Talnova
            </div>
          </Card>
        </div>

        {/* Navigation - Right Arrow */}
        <button 
          onClick={handleNext}
          className="absolute right-6 w-14 h-14 rounded-full flex items-center justify-center bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all hover:scale-105 z-10"
        >
          <ChevronRight className="h-8 w-8" />
        </button>
      </div>

      {/* Control Bar */}
      <div className="h-16 shrink-0 flex items-center justify-between border-t border-zinc-800/60 bg-zinc-900/90 px-8 z-10">
        <div className="text-xs text-zinc-500 font-mono">
          Auto-advancing every {intervalMs / 1000}s • Loop Active
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-full border-zinc-700 bg-zinc-800 text-white hover:bg-zinc-700"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
        </div>

        <div className="text-xs text-zinc-400 font-medium">
          Article {selectedArticleIndex + 1} of {articles.length}
        </div>
      </div>
    </div>
  );
}
