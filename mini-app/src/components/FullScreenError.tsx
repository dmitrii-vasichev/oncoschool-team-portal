interface FullScreenErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function FullScreenError({
  message = "Что-то пошло не так",
  onRetry,
}: FullScreenErrorProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-tg-bg px-8">
      <span className="text-4xl mb-3">&#x26A0;&#xFE0F;</span>
      <p className="text-tg-text text-center text-sm font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-tg-button text-tg-button-text rounded-xl px-6 py-2.5 text-sm font-medium mt-4 active:opacity-80 transition-opacity"
        >
          Повторить
        </button>
      )}
    </div>
  );
}
