interface GroupHeaderProps {
  title: string;
  className?: string;
}

export function GroupHeader({ title, className }: GroupHeaderProps) {
  return (
    <div
      className={`text-xs font-semibold uppercase tracking-wide mt-4 mb-2 ${
        className || "text-tg-section-header"
      }`}
    >
      {title}
    </div>
  );
}
