import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './utils';

// --- Context ---
interface CarouselContextValue {
  orientation: 'horizontal' | 'vertical';
  currentIndex: number;
  totalItems: number;
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  setTotalItems: (n: number) => void;
}

const CarouselContext = React.createContext<CarouselContextValue>({
  orientation: 'horizontal',
  currentIndex: 0,
  totalItems: 0,
  scrollPrev: () => {},
  scrollNext: () => {},
  canScrollPrev: false,
  canScrollNext: false,
  setTotalItems: () => {},
});

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Carousel = React.forwardRef<HTMLDivElement, CarouselProps>(
  ({ className, orientation = 'horizontal', children, ...props }, ref) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [totalItems, setTotalItems] = React.useState(0);

    const scrollPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
    const scrollNext = () => setCurrentIndex((i) => Math.min(totalItems - 1, i + 1));

    return (
      <CarouselContext.Provider
        value={{
          orientation,
          currentIndex,
          totalItems,
          scrollPrev,
          scrollNext,
          canScrollPrev: currentIndex > 0,
          canScrollNext: currentIndex < totalItems - 1,
          setTotalItems,
        }}
      >
        <div
          ref={ref}
          role="region"
          aria-roledescription="carousel"
          data-slot="carousel"
          className={cn('relative', className)}
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  }
);
Carousel.displayName = 'Carousel';

export const CarouselContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { orientation, currentIndex, setTotalItems } = React.useContext(CarouselContext);
    const items = React.Children.toArray(children);

    React.useEffect(() => {
      setTotalItems(items.length);
    }, [items.length, setTotalItems]);

    const transform =
      orientation === 'horizontal'
        ? `translateX(-${currentIndex * 100}%)`
        : `translateY(-${currentIndex * 100}%)`;

    return (
      <div className="overflow-hidden" data-slot="carousel-content">
        <div
          ref={ref}
          className={cn(
            'flex transition-transform duration-300 ease-in-out',
            orientation === 'vertical' && 'flex-col',
            className
          )}
          style={{ transform }}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);
CarouselContent.displayName = 'CarouselContent';

export const CarouselItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
      {...props}
    />
  )
);
CarouselItem.displayName = 'CarouselItem';

export const CarouselPrevious = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { scrollPrev, canScrollPrev, orientation } = React.useContext(CarouselContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="carousel-previous"
        disabled={!canScrollPrev}
        onClick={scrollPrev}
        className={cn(
          'absolute inline-flex size-7 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted disabled:opacity-50',
          orientation === 'horizontal'
            ? 'top-1/2 -left-12 -translate-y-1/2'
            : '-top-12 left-1/2 -translate-x-1/2 rotate-90',
          className
        )}
        {...props}
      >
        <ChevronLeft className="size-4" />
      </button>
    );
  }
);
CarouselPrevious.displayName = 'CarouselPrevious';

export const CarouselNext = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { scrollNext, canScrollNext, orientation } = React.useContext(CarouselContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="carousel-next"
        disabled={!canScrollNext}
        onClick={scrollNext}
        className={cn(
          'absolute inline-flex size-7 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-muted disabled:opacity-50',
          orientation === 'horizontal'
            ? 'top-1/2 -right-12 -translate-y-1/2'
            : '-bottom-12 left-1/2 -translate-x-1/2 rotate-90',
          className
        )}
        {...props}
      >
        <ChevronRight className="size-4" />
      </button>
    );
  }
);
CarouselNext.displayName = 'CarouselNext';
