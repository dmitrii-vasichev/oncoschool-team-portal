"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  accent?: boolean;
  moderatorOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/tasks", label: "Мои задачи", icon: "📋" },
  { href: "/tasks/new", label: "Создать", icon: "➕", accent: true },
  { href: "/all", label: "Все задачи", icon: "📊", moderatorOnly: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useAuth();

  const items = NAV_ITEMS.filter(
    (item) => !item.moderatorOnly || role === "admin" || role === "moderator"
  );

  const handleClick = () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred("light");
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-tg-separator z-30">
      <div className="flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");

          if (item.accent) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleClick}
                className="flex flex-col items-center justify-center"
              >
                <span className="bg-tg-button text-tg-button-text rounded-full w-10 h-10 flex items-center justify-center text-lg">
                  {item.icon}
                </span>
                <span className="text-[10px] text-tg-button mt-0.5">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleClick}
              className={`flex flex-col items-center justify-center ${
                isActive ? "text-tg-button" : "text-tg-hint"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
