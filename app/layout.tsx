import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '厨房库存与菜谱',
  description: '手机端菜谱和食材库存记录工具。',
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
