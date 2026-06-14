import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Roast Arena",
  description: "A pixel-art resume critique arena with animated agents and mock debate flow.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
