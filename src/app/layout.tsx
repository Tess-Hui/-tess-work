import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tess 工作台",
  description: "Tess 工作管理系统。",
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
