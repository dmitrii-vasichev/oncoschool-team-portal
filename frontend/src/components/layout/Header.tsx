"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/tasks": "Задачи",
  "/meetings": "Встречи",
  "/analytics": "Аналитика",
  "/summary": "Zoom Summary",
  "/team": "Команда",
  "/settings": "Настройки",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [path, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(path) && path !== "/") return title;
  }
  return "Онкошкола";
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="flex h-16 items-center border-b bg-card px-6">
      <h1 className="text-xl font-semibold">{getPageTitle(pathname)}</h1>
    </header>
  );
}
