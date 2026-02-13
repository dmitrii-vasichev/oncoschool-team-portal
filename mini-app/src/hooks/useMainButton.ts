import { useEffect, useRef } from "react";

interface UseMainButtonOptions {
  text: string;
  onClick: () => void;
  isVisible?: boolean;
  isLoading?: boolean;
}

export function useMainButton({
  text,
  onClick,
  isVisible = true,
  isLoading = false,
}: UseMainButtonOptions) {
  const callbackRef = useRef(onClick);
  callbackRef.current = onClick;

  useEffect(() => {
    const mb = window.Telegram?.WebApp?.MainButton;
    if (!mb) return;

    const handler = () => callbackRef.current();

    if (isVisible) {
      mb.setText(text);
      mb.show();
      mb.onClick(handler);
    } else {
      mb.hide();
    }

    return () => {
      mb.offClick(handler);
      mb.hide();
      mb.hideProgress();
    };
  }, [text, isVisible]);

  useEffect(() => {
    const mb = window.Telegram?.WebApp?.MainButton;
    if (!mb) return;

    if (isLoading) {
      mb.showProgress(false);
    } else {
      mb.hideProgress();
    }
  }, [isLoading]);
}
