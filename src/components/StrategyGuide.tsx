"use client";

import { useState } from "react";

export default function StrategyGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-6 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-300">
          무한매수법 V1 공식 안내
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* 준비 */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
              0
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">준비</p>
              <p className="text-xs text-gray-500 mt-0.5">
                총 투자금을 <span className="text-blue-400">40등분</span>합니다.
                <span className="text-gray-400"> 예) $10,000 → 1회분 = $250</span>
              </p>
            </div>
          </div>

          <div className="border-l-2 border-gray-800 ml-4 pl-6 space-y-4">
            {/* 매수 규칙 */}
            <div>
              <p className="text-sm font-medium text-emerald-400 mb-2">매수 규칙 (매일 종가 기준)</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">1</span>
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-200">첫 매수:</span> 무조건 <span className="text-emerald-400">1회분 금액</span> 매수
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">2</span>
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-200">종가 &lt; 평균단가:</span> <span className="text-emerald-400">1회분</span> 매수 (1배)
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">3</span>
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-200">종가 &ge; 평균단가:</span> <span className="text-yellow-400">0.5회분</span> 매수 (0.5배)
                  </p>
                </div>
              </div>
            </div>

            {/* 매도 규칙 */}
            <div>
              <p className="text-sm font-medium text-red-400 mb-2">매도 규칙</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 text-red-400 text-xs">&#x2713;</span>
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-200">목표 매도:</span> 종가가 <span className="text-red-400">평균단가 &times; 1.10</span> 이상이면 <span className="text-red-400">전량 매도</span>
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5 text-yellow-400 text-xs">&#x2713;</span>
                  <p className="text-xs text-gray-400">
                    <span className="text-gray-200">쿼터손절:</span> 매수 회차를 모두 소진하면 보유량의 <span className="text-yellow-400">25% 매도</span> 후 매수 재개
                  </p>
                </div>
              </div>
            </div>

            {/* 사이클 */}
            <div>
              <p className="text-sm font-medium text-purple-400 mb-2">사이클 반복</p>
              <p className="text-xs text-gray-400">
                전량 매도 후 수익금을 포함하여 <span className="text-purple-400">새로운 사이클</span>을 다시 시작합니다.
              </p>
            </div>
          </div>

          {/* 플로우 요약 */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="px-2 py-1 rounded bg-blue-500/15 text-blue-400">투자금 40등분</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400">매일 매수</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-red-500/15 text-red-400">+10% 전량 매도</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="px-2 py-1 rounded bg-purple-500/15 text-purple-400">새 사이클</span>
              <span className="text-gray-600">&rarr;</span>
              <span className="text-gray-500">반복</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
