import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InviteQR - Secure Party Management",
  description: "Hand-crafted premium guest management and check-in system.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans transition-colors duration-300`}
      >
        <ThemeProvider>
          <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <main className="flex-grow">{children}</main>

            {/* Global Navigation */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-8">
              <a href="/dashboard" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all">
                <span className="text-xs font-black uppercase tracking-widest">Dashboard</span>
              </a>
              <div className="w-[1px] h-4 bg-slate-200 dark:bg-white/10"></div>
              <a href="/scanner" className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all">
                <span className="text-xs font-black uppercase tracking-widest">Scanner</span>
              </a>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
