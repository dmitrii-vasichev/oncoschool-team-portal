interface EmptyStateProps {
  title?: string;
  subtitle?: string;
}

export function EmptyState({
  title = "Нет активных задач",
  subtitle = "Все задачи выполнены!",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-5xl mb-4">🎉</div>
      <div className="text-tg-text font-medium text-base">{title}</div>
      <div className="text-tg-hint text-sm mt-1">{subtitle}</div>
    </div>
  );
}
