const assert = require("assert");
const {
  INITIAL_STATIONS,
  mapChargerStatus,
  extractApiItems,
  mapApiItemsToStations
} = require("../js/data.js");
const {
  validateUserInput,
  calcNeededEnergyKwh,
  calcChargingMinutes,
  canAchieveWithinDwell
} = require("../js/calculator.js");
const { buildRecommendation, simulatePeakDistribution } = require("../js/recommender.js");
const { escapeHtml } = require("../js/ui.js");

// 1. 필요 충전 에너지 및 구간별 충전 시간 계산
assert.strictEqual(calcNeededEnergyKwh(30, 80, 60), 30);
assert.ok(calcChargingMinutes(30, 80, 60, 100, 100) > 0);
assert.strictEqual(calcChargingMinutes(80, 80, 60, 100, 100), 0);

// 2. 체류 시간 충족 여부(대기 시간 + 충전 시간 <= 체류 시간)
assert.strictEqual(canAchieveWithinDwell(10, 25, 45), true);
assert.strictEqual(canAchieveWithinDwell(20, 30, 45), false);

// 3. 입력 검증 실패 및 이미 목표 SOC 도달 예외
const invalidRes = validateUserInput({
  currentSoc: -5,
  targetSoc: 80,
  batteryKwh: 0,
  maxVehicleKw: 100,
  dwellMin: 45,
  hourSlot: 12
});
assert.strictEqual(invalidRes.valid, false);
assert.ok(invalidRes.errors.length >= 2);

const chargedRes = validateUserInput({
  currentSoc: 85,
  targetSoc: 80,
  batteryKwh: 60,
  maxVehicleKw: 100,
  dwellMin: 45,
  hourSlot: 12
});
assert.strictEqual(chargedRes.valid, true);
assert.strictEqual(chargedRes.alreadyCharged, true);

// 4. 이용 가능 충전소 없음 예외
const allDown = INITIAL_STATIONS.map(s => ({ ...s, status: "MAINTENANCE" }));
const noAvailRec = buildRecommendation(allDown, {
  region: "팔용동",
  currentSoc: 30,
  targetSoc: 80,
  batteryKwh: 60,
  maxVehicleKw: 100,
  dwellMin: 45,
  hourSlot: 12,
  season: "spring_fall"
});
assert.strictEqual(noAvailRec.status, "NO_AVAILABLE_STATION");

// 5. 조건 미충족 시 총 소요 시간(totalMin) 최단 충전소 선택
const fallbackRec = buildRecommendation(INITIAL_STATIONS, {
  region: "중앙동",
  currentSoc: 20,
  targetSoc: 90,
  batteryKwh: 70,
  maxVehicleKw: 100,
  dwellMin: 10,
  hourSlot: 20,
  season: "winter"
});
assert.strictEqual(fallbackRec.status, "OK");
assert.strictEqual(fallbackRec.isFallback, true);
const minAvailableTotal = Math.min(
  ...fallbackRec.evaluated.filter(s => s.meetsAvail).map(s => s.totalMin)
);
assert.strictEqual(fallbackRec.recommended.totalMin, minAvailableTotal);

// 6. 상태 코드 명시적 허용 목록 및 경계값 테스트
assert.strictEqual(mapChargerStatus("2"), "AVAILABLE");
assert.strictEqual(mapChargerStatus("3"), "AVAILABLE");
assert.strictEqual(mapChargerStatus("4"), "MAINTENANCE");
assert.strictEqual(mapChargerStatus("5"), "MAINTENANCE");
assert.strictEqual(mapChargerStatus("1"), "COMM_ERROR");
assert.strictEqual(mapChargerStatus("9"), "COMM_ERROR");
assert.strictEqual(mapChargerStatus("UNKNOWN"), "COMM_ERROR");
assert.strictEqual(mapChargerStatus(""), "COMM_ERROR");

// 7. API 응답 변형(단일 객체, 빈 응답, 미일치 주소) 및 HTML 이스케이프
const singleItemPayload = {
  items: {
    item: {
      statNm: '<script>alert(1)</script>중앙동 충전소',
      addr: "경상남도 창원시 성산구 중앙동 1",
      output: "100",
      stat: "99",
      statUpdDt: "20261127050000"
    }
  }
};
const mappedSingle = mapApiItemsToStations(singleItemPayload);
assert.strictEqual(mappedSingle.length, 1);
assert.strictEqual(mappedSingle[0].region, "중앙동");
assert.strictEqual(mappedSingle[0].status, "COMM_ERROR");
assert.strictEqual(extractApiItems({ items: { item: [] } }).length, 0);
assert.strictEqual(escapeHtml('<img src=x>'), "&lt;img src=x&gt;");

// 8. 수요 분산 시뮬레이션 테스트
const distSim = simulatePeakDistribution(INITIAL_STATIONS, 20, "winter");
assert.strictEqual(distSim.targetPeakRate, 65);
assert.strictEqual(distSim.rows.length, 3);

console.log("ALL TESTS PASSED");
