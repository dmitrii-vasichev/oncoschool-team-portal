import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useBackButton(enabled: boolean = true) {
  const router = useRouter();

  useEffect(() => {
    const WebApp = window.Telegram?.WebApp;
    if (!WebApp || !enabled) return;

    WebApp.BackButton.show();
    const handler = () => router.back();
    WebApp.BackButton.onClick(handler);

    return () => {
      WebApp.BackButton.offClick(handler);
      WebApp.BackButton.hide();
    };
  }, [router, enabled]);
}
