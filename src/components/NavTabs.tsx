"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { label: "무한매수법 V1", href: "/" },
  { label: "V4 시뮬레이터", href: "/backtest-v4" },
  { label: "밸류리밸런싱", href: "/backtest-vr" },
  { label: "VR 계산기", href: "/vr-calc" },
  { label: "트레이딩 대시보드", href: "/trading" },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-gray-800 mb-8 gap-1">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              active
                ? "bg-gray-800 text-white border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
