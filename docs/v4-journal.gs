// 무한매수법 V4 체결 일지 생성 스크립트
// 사용법:
// 1. script.google.com 에서 새 프로젝트 생성
// 2. 이 코드를 붙여넣기
// 3. createV4Journal() 함수 실행
// 4. 생성된 스프레드시트 URL 확인 후 북마크

function createV4Journal() {
  var ss = SpreadsheetApp.create('무한매수법 V4 체결 일지');
  var sheet = ss.getActiveSheet();
  sheet.setName('V4 일지');

  // ── 컬럼 너비 ──────────────────────────────────────────────
  sheet.setColumnWidth(1,  100); // A: 날짜
  sheet.setColumnWidth(2,  170); // B: 주문 종류
  sheet.setColumnWidth(3,   80); // C: 체결가
  sheet.setColumnWidth(4,   60); // D: 수량
  sheet.setColumnWidth(5,   90); // E: 금액
  sheet.setColumnWidth(6,   60); // F: T
  sheet.setColumnWidth(7,   90); // G: 평단가
  sheet.setColumnWidth(8,   80); // H: 보유수량
  sheet.setColumnWidth(9,  100); // I: 잔여캐시
  sheet.setColumnWidth(10,  70); // J: 모드
  sheet.setColumnWidth(11,  30); // K: 여백
  sheet.setColumnWidth(12,  20); // L: 헬퍼 (숨김)
  sheet.setColumnWidth(13,  20); // M: 헬퍼 (숨김)
  sheet.setColumnWidth(14, 220); // N: 요약 레이블
  sheet.setColumnWidth(15, 180); // O: 요약 값

  // ── CONFIG (rows 3-6) ──────────────────────────────────────
  sheet.getRange('A3').setValue('총 투자금 ($)');
  sheet.getRange('C3').setValue(10000);
  sheet.getRange('A4').setValue('라운드 수');
  sheet.getRange('C4').setValue(40);
  sheet.getRange('A5').setValue('목표 수익률 (%)');
  sheet.getRange('C5').setValue(15);
  sheet.getRange('A6').setValue('LOC 마진 (%)');
  sheet.getRange('C6').setValue(5);

  // config 레이블 스타일
  sheet.getRange('A3:A6').setFontWeight('bold');

  // ── 헤더 (row 9) ──────────────────────────────────────────
  var headers = ['날짜', '주문 종류', '체결가 ($)', '수량', '금액', 'T', '평단가', '보유수량', '잔여캐시 ($)', '모드'];
  sheet.getRange(9, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(9, 1, 1, headers.length).setFontWeight('bold');
  sheet.getRange(9, 1, 1, headers.length).setBackground('#e8eaf6');

  // ── SEED ROW (row 10) ─────────────────────────────────────
  // 초기 상태: T=0, avgCost=0, shares=0, cash=총투자금, mode=normal
  sheet.getRange('A10').setValue('(초기값)');
  sheet.getRange('B10').setValue('—');
  sheet.getRange('F10').setValue(0);
  sheet.getRange('G10').setValue(0);
  sheet.getRange('H10').setValue(0);
  sheet.getRange('I10').setFormula('=$C$3');
  sheet.getRange('J10').setValue('normal');
  sheet.getRange('A10:J10').setFontColor('#999999').setFontStyle('italic');

  // ── DROPDOWN (rows 11-310) ─────────────────────────────────
  var kindValues = [
    'buy_half_star',
    'buy_half_avg',
    'buy_full_star',
    'reverse_quarter_buy',
    'quarter_sell_star',
    'reverse_ladder_sell',
    'reverse_moc_sell',
    'final_sell_target'
  ];
  var kindRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(kindValues, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(11, 2, 300, 1).setDataValidation(kindRule);

  // ── 날짜 포맷 (col A, rows 11-310) ───────────────────────
  sheet.getRange(11, 1, 300, 1).setNumberFormat('yyyy-mm-dd');

  // ── FILL ROW 수식 (rows 11-310) ────────────────────────────
  // 성능: 열별로 배열을 구성 후 setFormulas() 일괄 처리
  var FILL_START = 11;
  var FILL_END   = 310;
  var FILL_ROWS  = FILL_END - FILL_START + 1; // 300

  var amtFormulas    = [];
  var tFormulas      = [];
  var avgFormulas    = [];
  var sharesFormulas = [];
  var cashFormulas   = [];
  var modeFormulas   = [];

  for (var r = FILL_START; r <= FILL_END; r++) {
    var p = r - 1; // 이전 행

    // E: 금액
    amtFormulas.push(['=IF(A' + r + '="","",ROUND(C' + r + '*D' + r + ',2))']);

    // F: T
    tFormulas.push([
      '=IF(A' + r + '="","",IF(B' + r + '="buy_half_star",F' + p + '+0.5,' +
      'IF(B' + r + '="buy_half_avg",F' + p + '+0.5,' +
      'IF(B' + r + '="buy_full_star",F' + p + '+1,' +
      'IF(B' + r + '="reverse_quarter_buy",F' + p + '+($C$4-F' + p + ')*0.25,' +
      'IF(B' + r + '="quarter_sell_star",F' + p + '*0.75,' +
      'IF(B' + r + '="reverse_ladder_sell",F' + p + '*0.95,' +
      'IF(B' + r + '="reverse_moc_sell",F' + p + '*0.95,' +
      'IF(B' + r + '="final_sell_target",0,F' + p + ')))))))))'
    ]);

    // G: avgCost
    avgFormulas.push([
      '=IF(A' + r + '="","",IF(OR(B' + r + '="buy_half_star",B' + r + '="buy_half_avg",B' + r + '="buy_full_star",B' + r + '="reverse_quarter_buy"),' +
        'IF(H' + p + '+D' + r + '>0,ROUND((G' + p + '*H' + p + '+E' + r + ')/(H' + p + '+D' + r + '),4),0),' +
        'IF(B' + r + '="final_sell_target",0,G' + p + ')))'
    ]);

    // H: totalShares
    sharesFormulas.push([
      '=IF(A' + r + '="","",IF(OR(B' + r + '="buy_half_star",B' + r + '="buy_half_avg",B' + r + '="buy_full_star",B' + r + '="reverse_quarter_buy"),' +
        'H' + p + '+D' + r + ',' +
        'IF(B' + r + '="final_sell_target",0,MAX(0,H' + p + '-D' + r + '))))'
    ]);

    // I: cycleCash
    cashFormulas.push([
      '=IF(A' + r + '="","",IF(OR(B' + r + '="buy_half_star",B' + r + '="buy_half_avg",B' + r + '="buy_full_star",B' + r + '="reverse_quarter_buy"),' +
        'ROUND(I' + p + '-E' + r + ',2),' +
        'ROUND(I' + p + '+E' + r + ',2)))'
    ]);

    // J: mode
    modeFormulas.push([
      '=IF(A' + r + '="","",IF(B' + r + '="final_sell_target","normal",' +
        'IF(AND(J' + p + '="normal",H' + r + '>0,F' + r + '>$C$4-1),"reverse",' +
        'IF(AND(J' + p + '="reverse",H' + r + '<=0),"normal",' +
        'J' + p + '))))'
    ]);
  }

  // 일괄 수식 적용
  sheet.getRange(FILL_START, 5, FILL_ROWS, 1).setFormulas(amtFormulas);    // E
  sheet.getRange(FILL_START, 6, FILL_ROWS, 1).setFormulas(tFormulas);      // F
  sheet.getRange(FILL_START, 7, FILL_ROWS, 1).setFormulas(avgFormulas);    // G
  sheet.getRange(FILL_START, 8, FILL_ROWS, 1).setFormulas(sharesFormulas); // H
  sheet.getRange(FILL_START, 9, FILL_ROWS, 1).setFormulas(cashFormulas);   // I
  sheet.getRange(FILL_START, 10, FILL_ROWS, 1).setFormulas(modeFormulas);  // J

  // ── 헬퍼 셀 (L2:L6) ───────────────────────────────────────
  // COUNTA 기반으로 마지막 체결 행의 값을 참조
  var cnt = 'COUNTA(A11:A310)';
  sheet.getRange('L2').setFormula('=IFERROR(INDEX(F11:F310,' + cnt + '),0)');
  sheet.getRange('L3').setFormula('=IFERROR(INDEX(G11:G310,' + cnt + '),0)');
  sheet.getRange('L4').setFormula('=IFERROR(INDEX(H11:H310,' + cnt + '),0)');
  sheet.getRange('L5').setFormula('=IFERROR(INDEX(I11:I310,' + cnt + '),$C$3)');
  sheet.getRange('L6').setFormula('=IFERROR(INDEX(J11:J310,' + cnt + '),"normal")');

  // L, M 열 숨기기
  sheet.hideColumns(12, 2);

  // ── SUMMARY 패널 (N:O) ─────────────────────────────────────
  // 공유 변수 (수식 내부에서 사용)
  var sp     = 'ROUND(L3*(1+(15-0.75*L2)/100),2)';          // 별지점
  var tp     = 'ROUND(L3*(1+$C$5/100),2)';                   // 익절 목표가
  var budget = 'ROUND(L5/MAX($C$4-L2,0.5),2)';              // 다음 매수 예산
  var bm     = '(1+$C$6/100)';                               // 매수 마진 팩터
  var sm     = '(1-$C$6/100)';                               // 매도 마진 팩터

  // 레이블 배열 (N열)
  var labels = [
    '■ 현재 상태',
    'T / 라운드',
    '평단가 ($)',
    '보유 수량',
    '잔여 캐시 ($)',
    '모드',
    '',
    '별지점 ($)',
    '익절 목표가 ($)',
    '리버스 종료 기준 ($)',
    '다음 매수 예산 ($)',
    '',
    '■ 다음 주문 계획',
    '[매수] 첫 매수 예산',
    '[매수] 전반전 별지점 0.5배',
    '[매수] 전반전 평단가 0.5배',
    '[매수] 후반전 별지점 1배',
    '[매도] 쿼터 @ 별지점',
    '[매도] 익절 @ 목표가 (마진 없음)'
  ];

  // 값/수식 배열 (O열)
  var values = [
    '',                                                                              // O1: 제목 행
    '=TEXT(L2,"0.00")&" / "&$C$4',                                                  // O2
    '=IF(L3=0,"—","$"&TEXT(L3,"0.00"))',                                            // O3
    '=IF(L4=0,"—",L4&"주")',                                                        // O4
    '="$"&TEXT(L5,"#,##0.00")',                                                     // O5
    '=L6',                                                                          // O6
    '',                                                                              // O7
    '=IF(L3=0,"—","$"&TEXT(' + sp + ',"0.00"))',                                   // O8
    '=IF(L3=0,"—","$"&TEXT(' + tp + ',"0.00"))',                                   // O9
    '=IF(L3=0,"—","$"&TEXT(ROUND(L3*0.85,2),"0.00"))',                             // O10
    '="$"&TEXT(' + budget + ',"#,##0.00")',                                         // O11
    '',                                                                              // O12
    '',                                                                              // O13: 제목 행
    '=IF(OR(L4>0,L6="reverse"),"—","$"&TEXT(' + budget + ',"#,##0.00")&" (현재가 기준)")',  // O14
    '=IF(OR(L4=0,L2>=$C$4/2,L6="reverse"),"—",FLOOR(' + budget + '*0.5/(' + sp + '*' + bm + '))&"주 @ $"&TEXT(ROUND(' + sp + '*' + bm + ',2),"0.00"))',  // O15
    '=IF(OR(L4=0,L2>=$C$4/2,L6="reverse"),"—",FLOOR(' + budget + '*0.5/(L3*' + bm + '))&"주 @ $"&TEXT(ROUND(L3*' + bm + ',2),"0.00"))',                 // O16
    '=IF(OR(L4=0,L2<$C$4/2,L6="reverse"),"—",FLOOR(' + budget + '/(' + sp + '*' + bm + '))&"주 @ $"&TEXT(ROUND(' + sp + '*' + bm + ',2),"0.00"))',      // O17
    '=IF(OR(L4=0,L6="reverse"),"—",FLOOR(L4*0.25)&"주 @ $"&TEXT(ROUND(' + sp + '*' + sm + ',2),"0.00"))',                                                // O18
    '=IF(OR(L4=0,L6="reverse"),"—",(L4-FLOOR(L4*0.25))&"주 @ $"&TEXT(' + tp + ',"0.00"))'                                                               // O19
  ];

  // N열 레이블 쓰기
  for (var i = 0; i < labels.length; i++) {
    var row = i + 1;
    sheet.getRange(row, 14).setValue(labels[i]);
  }

  // O열 수식/값 쓰기
  for (var j = 0; j < values.length; j++) {
    var oRow = j + 1;
    var val  = values[j];
    if (val === '') {
      sheet.getRange(oRow, 15).setValue('');
    } else if (val.charAt(0) === '=') {
      sheet.getRange(oRow, 15).setFormula(val);
    } else {
      sheet.getRange(oRow, 15).setValue(val);
    }
  }

  // ── SUMMARY 스타일 ─────────────────────────────────────────
  // 제목 행 (row 1, 13): 볼드
  sheet.getRange(1,  14).setFontWeight('bold').setFontSize(11);
  sheet.getRange(13, 14).setFontWeight('bold').setFontSize(11);

  // 레이블 열 (N): 회색, 10pt
  sheet.getRange(1, 14, labels.length, 1).setFontColor('#666666').setFontSize(10);
  // 제목만 다시 기본색으로
  sheet.getRange(1,  14).setFontColor('#222222');
  sheet.getRange(13, 14).setFontColor('#222222');

  // 값 열 (O): 기본 스타일, 10pt
  sheet.getRange(1, 15, values.length, 1).setFontSize(10);

  // ── 행 고정 / 기타 ─────────────────────────────────────────
  sheet.setFrozenRows(9); // 헤더까지 고정

  // ── 최종 ──────────────────────────────────────────────────
  Logger.log(ss.getUrl());
  Browser.msgBox(
    '✅ V4 체결 일지 생성 완료!\n\n' +
    'URL: ' + ss.getUrl() + '\n\n' +
    '11행부터 날짜(A), 주문종류(B), 체결가(C), 수량(D)를 입력하세요.\n' +
    '오른쪽 N~O열에서 현재 상태와 다음 주문 계획을 확인할 수 있습니다.'
  );
}
