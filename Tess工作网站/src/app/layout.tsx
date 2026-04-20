import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tess Work Manager",
  description: "Personal work management dashboard for Tess.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
