import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "思い出ベースの手放し判断支援",
  description: "思い出ベースの手放し判断支援MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
