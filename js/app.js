const dashboardState = {
  stations: JSON.parse(JSON.stringify(INITIAL_STATIONS)),
  distributionSim: null
};

function readUserInput(doc = document) {
  return {
    region: doc.getElementById("region").value,
    destination: doc.getElementById("destination").value,
    currentSoc: Number(doc.getElementById("currentSoc").value),
    targetSoc: Number(doc.getElementById("targetSoc").value),
    batteryKwh: Number(doc.getElementById("batteryKwh").value),
    maxVehicleKw: Number(doc.getElementById("maxVehicleKw").value),
    dwellMin: Number(doc.getElementById("dwellMin").value),
    hourSlot: Number(doc.getElementById("hourSlot").value),
    season: doc.getElementById("season").value
  };
}

function readFilters(doc = document) {
  return {
    region: doc.getElementById("filterRegion").value,
    type: doc.getElementById("filterType").value,
    avail: doc.getElementById("filterAvail").value,
    sortBy: doc.getElementById("sortBy").value
  };
}

function updateDashboard(doc = document) {
  const input = readUserInput(doc);
  const filters = readFilters(doc);
  const recArea = doc.getElementById("recommendationArea");
  const distArea = doc.getElementById("distributionArea");
  const patternArea = doc.getElementById("timePatternArea");
  const tbody = doc.getElementById("stationTableBody");
  const validation = validateUserInput(input);

  renderTimePatternPanel(patternArea, input.hourSlot, input.season);
  renderDistributionPanel(distArea, dashboardState.distributionSim);

  if (!validation.valid) {
    renderRecommendationPanel(recArea, input, {
      status: "INVALID_INPUT",
      errors: validation.errors
    });
    renderStationTable(tbody, [], filters);
    return;
  }

  if (validation.alreadyCharged) {
    renderRecommendationPanel(recArea, input, { status: "ALREADY_CHARGED" });
    renderStationTable(tbody, evaluateStations(dashboardState.stations, input), filters);
    return;
  }

  const result = buildRecommendation(dashboardState.stations, input);
  renderRecommendationPanel(recArea, input, result);
  renderStationTable(tbody, result.evaluated, filters);
}

async function tryLoadApi(doc = document, fetchFn = fetch) {
  const key = doc.getElementById("apiKey").value.trim();
  const statusEl = doc.getElementById("apiStatus");
  if (!key) {
    statusEl.innerHTML = `<span class="badge badge-sim">시뮬레이션/샘플</span> ServiceKey가 비어 있어 내장 샘플 데이터를 사용합니다.`;
    return;
  }
  statusEl.innerHTML = `<span class="badge badge-real">API 조회중</span> 한국환경공단 충전소 API 호출 중...`;
  try {
    const url = `https://apis.data.go.kr/B552584/EvCharger/getChargerInfo?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=30&zcode=48&dataType=JSON`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const mapped = mapApiItemsToStations(data);
    if (mapped.length === 0) {
      statusEl.innerHTML = `<span class="badge badge-sim">샘플 유지</span> API 응답은 수신했으나 팔용동·중앙동·석동 일치 항목이 없어 샘플 데이터를 유지합니다.`;
      return;
    }
    dashboardState.stations = mapped;
    statusEl.innerHTML = `<span class="badge badge-real">API+가정 반영</span> ${escapeHtml(dashboardState.stations.length)}건을 반영했습니다(대기·우회·가동률은 시뮬레이션 가정 병행).`;
    updateDashboard(doc);
  } catch (err) {
    statusEl.innerHTML = `<span class="badge badge-sim">시뮬레이션 유지</span> 직접 브라우저 호출이 제한되었거나 응답에 실패했습니다(${escapeHtml(err.message)}). 내장 샘플 데이터로 계속 동작합니다.`;
  }
}

function resetSampleStations(doc = document) {
  dashboardState.stations = JSON.parse(JSON.stringify(INITIAL_STATIONS));
  dashboardState.distributionSim = null;
  doc.getElementById("apiStatus").innerHTML =
    `<span class="badge badge-sim">시뮬레이션/샘플</span> 내장 샘플 데이터(팔용동·중앙동·석동)로 복원했습니다.`;
  updateDashboard(doc);
}

function initApp(doc = document) {
  doc.getElementById("runBtn").addEventListener("click", () => updateDashboard(doc));
  doc.getElementById("simDistBtn").addEventListener("click", () => {
    const input = readUserInput(doc);
    dashboardState.distributionSim = simulatePeakDistribution(dashboardState.stations, input.hourSlot, input.season);
    updateDashboard(doc);
  });
  doc.getElementById("loadApiBtn").addEventListener("click", () => tryLoadApi(doc));
  doc.getElementById("resetSampleBtn").addEventListener("click", () => resetSampleStations(doc));
  ["filterRegion", "filterType", "filterAvail", "sortBy"].forEach(id => {
    doc.getElementById(id).addEventListener("change", () => updateDashboard(doc));
  });
  updateDashboard(doc);
}

if (typeof document !== "undefined") {
  initApp(document);
}
