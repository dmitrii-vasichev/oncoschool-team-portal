interface TaskSkeletonProps {
  count?: number;
}

export function TaskSkeleton({ count = 3 }: TaskSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-tg-secondary-bg animate-pulse rounded-xl h-[68px] mb-2 p-3"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-tg-hint/20 rounded-full" />
            <div className="h-3 bg-tg-hint/20 rounded w-8" />
            <div className="h-3 bg-tg-hint/20 rounded flex-1 max-w-[60%]" />
          </div>
          <div className="flex items-center gap-2 mt-3 ml-6">
            <div className="h-4 bg-tg-hint/20 rounded-full w-16" />
            <div className="h-3 bg-tg-hint/20 rounded w-10" />
          </div>
        </div>
      ))}
    </>
  );
}
