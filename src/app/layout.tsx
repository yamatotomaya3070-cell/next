import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "つなぐワークス | 動画編集ワークサポート",
  description:
    "動画編集のお仕事を安心して進められるワークスペース — 案件の受注から納品までをサポートします",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
