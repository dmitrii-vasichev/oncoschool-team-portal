import type { Metadata } from "next";
import { Manrope, Commissioner } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/layout/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/shared/Toast";
import { PageTitleProvider } from "@/hooks/usePageTitle";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--font-heading",
  display: "swap",
});

const commissioner = Commissioner({
  subsets: ["cyrillic", "latin"],
  variable: "--font-body",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    template: "%s — Онкошкола",
    default: "Онкошкола — Таск-менеджер",
  },
  description: "Система управления задачами для команды Онкошколы",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${manrope.variable} ${commissioner.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ToastProvider>
            <PageTitleProvider>
              <AppShell>{children}</AppShell>
            </PageTitleProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
