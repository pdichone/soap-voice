export function LoadingSpinner({ size = 'md', text = 'Loading...' }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizeClasses[size]} animate-spin rounded-full border-primary border-t-transparent`}
      />
      {text && <p className="text-sm text-gray-500 animate-pulse">{text}</p>}
    </div>
  );
}

export function LoadingBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-100 overflow-hidden">
      <div className="h-full w-1/3 bg-primary animate-loading-bar" />
    </div>
  );
}

export function PageLoading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-gray-500 animate-pulse">{text}</p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-24 bg-gray-200 rounded-lg" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-200 rounded-lg" />
      ))}
    </div>
  );
}
