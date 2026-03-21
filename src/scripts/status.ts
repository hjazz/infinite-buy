import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { loadState } from "../lib/trading/state";

function main() {
  console.log("═══════════════════════════════════════");
  console.log("  무한매수법 트레이딩 상태");
  console.log("═══════════════════════════════════════");

  const state = loadState();

  if (!state) {
    console.log("\n아직 트레이딩 상태가 없습니다.");
    console.log("npm run trade 명령으로 첫 실행을 하세요.");
    return;
  }

  const { config, cycle } = state;

  console.log(`\n[설정]`);
  console.log(`  종목: ${config.ticker}`);
  console.log(`  총 자본: $${config.totalCapital.toLocaleString()}`);
  console.log(`  라운드: ${config.rounds}회`);
  console.log(`  목표 수익률: ${(config.targetReturn * 100).toFixed(1)}%`);

  console.log(`\n[현재 사이클 #${cycle.cycleNumber}]`);
  console.log(`  시작일: ${cycle.startDate}`);
  console.log(`  보유수량: ${cycle.totalShares.toFixed(4)}주`);
  console.log(`  평균단가: $${cycle.avgCost.toFixed(2)}`);
  console.log(
    `  목표가: $${(cycle.avgCost * (1 + config.targetReturn)).toFixed(2)}`,
  );
  console.log(`  사용 라운드: ${cycle.roundsUsed} / ${config.rounds}`);
  console.log(`  잔여 현금: $${cycle.cycleCash.toFixed(2)}`);
  console.log(`  총 자산: $${cycle.totalCash.toFixed(2)}`);

  console.log(`\n[실행 정보]`);
  console.log(`  마지막 거래일: ${state.lastTradeDate || "없음"}`);
  console.log(`  생성일: ${state.createdAt}`);
  console.log(`  갱신일: ${state.updatedAt}`);
  console.log("═══════════════════════════════════════");
}

main();
