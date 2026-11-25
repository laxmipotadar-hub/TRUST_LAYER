export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-skeleton rounded-md ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading dashboard">
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4">
        <SkeletonBlock className="mb-3 h-4 w-56" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SkeletonBlock className="h-72 lg:col-span-4" />
        <SkeletonBlock className="h-72 lg:col-span-8" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}
