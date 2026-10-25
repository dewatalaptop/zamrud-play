export function LoadingSkeleton({ rows = 3, height = 72 }: { rows?: number; height?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ height }} />)}
    </div>
  );
}
export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }, (_, i) => <div key={i} className="skeleton h-56" />)}
    </div>
  );
}
