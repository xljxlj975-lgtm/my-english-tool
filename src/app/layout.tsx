import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ToastProvider from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "English Mistake Review Tool",
  description: "Master your English mistakes with spaced repetition",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <ToastProvider>
          <Navigation />
          <main className="min-h-screen pb-24 md:pb-0">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
