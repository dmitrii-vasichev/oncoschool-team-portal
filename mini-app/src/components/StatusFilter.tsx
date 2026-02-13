"use client";

interface StatusFilterProps {
  value: string | null;
  onChange: (status: string | null) => void;
}

const FILTERS = [
  { label: "Все", value: null },
  { label: "Новые", value: "new" },
  { label: "В работе", value: "in_progress" },
  { label: "Ревью", value: "review" },
] as const;

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const handleClick = (filterValue: string | null) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
    onChange(filterValue);
  };

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
      {FILTERS.map((filter) => (
        <button
          key={filter.label}
          onClick={() => handleClick(filter.value)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
            value === filter.value
              ? "bg-tg-button text-tg-button-text"
              : "bg-tg-secondary-bg text-tg-hint"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
