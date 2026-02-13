interface PullIndicatorProps {
  isRefreshing: boolean;
}

export function PullIndicator({ isRefreshing }: PullIndicatorProps) {
  if (!isRefreshing) {
    return <div className="h-0 overflow-hidden" />;
  }

  return (
    <div className="h-10 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-tg-button border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
