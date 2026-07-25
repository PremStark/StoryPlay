import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persona — Rewrite the story",
  description: "Choose a character, choose a moment, and discover a new path.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
