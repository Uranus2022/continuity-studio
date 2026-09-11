import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Continuity Studio",
  description: "AI filmmaking workspace with character, world and continuity locking.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
