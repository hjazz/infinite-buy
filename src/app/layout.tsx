import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "무한매수법 백테스트 시뮬레이터",
  description: "라오어의 무한매수법(V1)을 과거 주가 데이터로 백테스트합니다",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
