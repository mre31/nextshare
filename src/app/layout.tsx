import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { startCleanupScheduler } from "@/lib/cleanupScheduler";
import RecentUploads from "@/components/RecentUploads";
import ClientProvider from "@/components/ClientProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextShare - by mre31",
  description: "Easy and fast file sharing application",
};

// Uygulamayı başlatırken temizleme zamanlamasını çalıştır
if (typeof window === 'undefined') {
  // Sadece sunucu tarafında çalıştır
  startCleanupScheduler();
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-900`}
      >
        {children}
        {/* Recent Uploads widget */}
        <ClientProvider>
          <RecentUploads />
        </ClientProvider>
      </body>
    </html>
  );
}
