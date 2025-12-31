/* position.js — 显示红色方块的用户点 + 竖排注释，并额外显示蓝色 star 的估算最终位置
   依赖：PapaParse、Plotly（已由 index.html 引入）
   数据：data/TEKMA.csv（列：VOC, NOX, 24NOX, M1M1O3）
*/
(function () {
  'use strict';

  const STEP_VOC = 0.5;
  const STEP_NOX = 1.0;

  // ===== 工具函数 =====
  function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; }
  function mid(a, b) { return { x: (a.x + b.x)/2, y: (a.y + b.y)/2, VOC: (a.VOC + b.VOC)/2, NOX: (a.NOX + b.NOX)/2 }; }
  function centerOfQuad(A, B, C, D) {
    return { x: (A.x + B.x + C.x + D.x)/4, y: (A.y + B.y + C.y + D.y)/4,
             VOC: (A.VOC + B.VOC + C.VOC + D.VOC)/4, NOX: (A.NOX + B.NOX + C.NOX + D.NOX)/4 };
  }
  function pointInPolygon(polyXY, p) {
    let inside = false;
    for (let i = 0, j = polyXY.length - 1; i < polyXY.length; j = i++) {
      const xi = polyXY[i].x, yi = polyXY[i].y;
      const xj = polyXY[j].x, yj = polyXY[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function quantize(v, step) { return Math.round(v / step) * step; }
  function mkKey(V, N) { return `${V.toFixed(6)}|${N.toFixed(6)}`; }

  // ===== CSV 初始化网格 =====
  function initGridFromCSV() {
    if (window.TEKMA_GRID && window.TEKMA_GRID.map instanceof Map && window.TEKMA_GRID.map.size > 0) {
      return; // 已存在
    }
    if (typeof Papa === 'undefined') { console.error('[position.js] PapaParse 未加载'); return; }
    Papa.parse('data/TEKMA.csv', {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: function (results) {
        const rows = results.data || [];
        const map = new Map();
        let valid = 0;
        for (const r of rows) {
          const voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
          if ([voc, nox, x, y].every(v => typeof v === 'number' && !isNaN(v))) {
            const Vq = quantize(voc, STEP_VOC);
            const Nq = quantize(nox, STEP_NOX);
            map.set(mkKey(Vq, Nq), { x, y, VOC: Vq, NOX: Nq });
            valid++;
          }
        }
        if (valid === 0) { console.error('[position.js] TEKMA.csv 没有有效数据'); return; }
        window.TEKMA_GRID = { stepVoc: STEP_VOC, stepNox: STEP_NOX, map, key: mkKey };
      },
      error: function (err) { console.error('[position.js] TEKMA.csv 加载失败:', err); }
    });
  }
  function isGridReady() { const g = window.TEKMA_GRID; return !!(g && g.map instanceof Map && g.map.size > 0); }

  // ===== 网格访问 =====
  function gridGet(voc, nox) {
    const G = window.TEKMA_GRID; if (!G || !G.map) return null;
    const Vq = quantize(voc, G.stepVoc); const Nq = quantize(nox, G.stepNox);
    const key = (typeof G.key === 'function') ? G.key(Vq, Nq) : mkKey(Vq, Nq);
    let g = G.map.get(key);
    if (g) return { x: g.x, y: g.y, VOC: g.VOC, NOX: g.NOX };
    // 宽容回退：半步长范围
    const tolV = G.stepVoc / 2 + 1e-9, tolN = G.stepNox / 2 + 1e-9;
    let best = null, bestCost = Infinity;
    G.map.forEach((val) => {
      const dvv = Math.abs(val.VOC - voc), dnn = Math.abs(val.NOX - nox);
      if (dvv <= tolV && dnn <= tolN) {
        const cost = dvv*dvv + dnn*dnn; if (cost < bestCost) { bestCost = cost; best = val; }
      }
    });
    return best ? { x: best.x, y: best.y, VOC: best.VOC, NOX: best.NOX } : null;
  }
  function findNearestGridPointByXY(x, y) {
    const grid = window.TEKMA_GRID?.map; if (!grid) return null;
    let best = null, bestD2 = Infinity;
    grid.forEach((val) => { const d2 = dist2(x, y, val.x, val.y); if (d2 < bestD2) { bestD2 = d2; best = { x: val.x, y: val.y, VOC: val.VOC, NOX: val.NOX }; } });
    return best;
  }

  // ===== 相邻四边形 =====
  function buildAdjacentQuads(center) {
    const dv = window.TEKMA_GRID?.stepVoc ?? STEP_VOC;
    const dn = window.TEKMA_GRID?.stepNox ?? STEP_NOX;
    const V = center.VOC, N = center.NOX;
    const P = {
      V0N0: gridGet(V, N),
      VmN0: gridGet(V - dv, N),
      VpN0: gridGet(V + dv, N),
      V0Nm: gridGet(V, N - dn),
      V0Np: gridGet(V, N + dn),
      VmNm: gridGet(V - dv, N - dn),
      VpNm: gridGet(V + dv, N - dn),
      VmNp: gridGet(V - dv, N + dn),
      VpNp: gridGet(V + dv, N + dn)
    };
    const quads = [];
    if (P.VmNm && P.V0Nm && P.V0N0 && P.VmN0) quads.push([P.VmNm, P.V0Nm, P.V0N0, P.VmN0]);
    if (P.V0Nm && P.VpNm && P.VpN0 && P.V0N0) quads.push([P.V0Nm, P.VpNm, P.VpN0, P.V0N0]);
    if (P.V0N0 && P.VpN0 && P.VpNp && P.V0Np) quads.push([P.V0N0, P.VpN0, P.VpNp, P.V0Np]);
    if (P.VmN0 && P.V0N0 && P.V0Np && P.VmNp) quads.push([P.VmN0, P.V0N0, P.V0Np, P.VmNp]);
    return quads;
  }
  function chooseQuadContainingPoint(quads, userXY, options = { allowFallback: true }) {
    if (!quads.length) return null;
    let best = null, bestD2 = Infinity;
    for (const q of quads) {
      const polyXY = q.map(p => ({ x: p.x, y: p.y }));
      if (pointInPolygon(polyXY, userXY)) return q;
      const C = centerOfQuad(q[0], q[1], q[2], q[3]);
      const d2 = dist2(userXY.x, userXY.y, C.x, C.y);
      if (d2 < bestD2) { bestD2 = d2; best = q; }
    }
    return options.allowFallback ? best : null;
  }
  function subdivideQuad(A, B, C, D) {
    const AB = mid(A, B), BC = mid(B, C), CD = mid(C, D), DA = mid(D, A);
    const M  = centerOfQuad(A, B, C, D);
    return [
      [A,  AB, M,  DA],
      [AB, B,  BC, M ],
      [M,  BC, C,  CD],
      [DA, M,  CD, D ]
    ];
  }
  function refineToLevel(initialQuad, userXY, levels = 8) {
    let q = initialQuad;
    for (let lvl = 0; lvl < levels; lvl++) {
      const subs = subdivideQuad(q[0], q[1], q[2], q[3]);
      const chosen = chooseQuadContainingPoint(subs, userXY, { allowFallback: true });
      q = chosen || subs[0];
    }
    return q;
  }

  // ===== 主估算 =====
  function estimateFromXY(userX, userY, levels = 8) {
    if (!isGridReady()) return { ok: false, reason: 'TEKMA 网格未准备好' };
    const nearest = findNearestGridPointByXY(userX, userY);
    if (!nearest) return { ok: false, reason: '找不到最近网格点（空网格）' };
    const quads = buildAdjacentQuads(nearest);
    if (!quads.length) return { ok: false, reason: '附近四边形角点不全（边界/缺失）', nearest };
    const initialQuad = chooseQuadContainingPoint(quads, { x: userX, y: userY }, { allowFallback: false });
    if (!initialQuad) {
      return { ok: false, reason: '输入点不在任何初始四边形内（范围外）', nearestGrid: nearest, quadsChecked: quads.length };
    }
    const finalQuad = refineToLevel(initialQuad, { x: userX, y: userY }, levels);
    let bestCorner = null, bestD2 = Infinity;
    for (const corner of finalQuad) {
      const d2 = dist2(userX, userY, corner.x, corner.y);
      if (d2 < bestD2) { bestD2 = d2; bestCorner = corner; }
    }
    return { ok: true, estimate: { VOC: bestCorner.VOC, NOX: bestCorner.NOX }, finalQuad, chosenCorner: bestCorner, levels };
  }

  // ===== 绘图：红色方块 + 注释 + 蓝色 star（估算最终位置） =====
  function ensurePlotInitialized() {
    const plotDiv = document.getElementById('plot');
    if (!plotDiv) return Promise.reject(new Error('Plot 容器不存在'));
    if (typeof Plotly === 'undefined') return Promise.reject(new Error('Plotly 未加载'));
    if (plotDiv.data || plotDiv._fullData || plotDiv.layout) return Promise.resolve(plotDiv);
    const baseLayout = {
      title: 'T‑EKMA Diagram', xaxis: { title: '24NOX (X)', gridcolor: '#eee' }, yaxis: { title: 'M1M1O3 (Y)', gridcolor: '#eee' },
      legend: { orientation: 'h', x: 0, y: 1.08 }, plot_bgcolor: '#fafafa', uirevision: 'bg'
    };
    return Plotly.newPlot(plotDiv, [], baseLayout, { responsive: true });
  }
  function findTraceIndexByMeta(metaTag) {
    const plotDiv = document.getElementById('plot');
    const traces = plotDiv?.data || (plotDiv?._fullData ? plotDiv._fullData.map(d => d) : []);
    for (let i = 0; i < traces.length; i++) { const tr = traces[i]; if (tr && tr.meta === metaTag) return i; }
    return -1;
  }
  function upsertUserTraceSquare(x, y, voc, nox) {
    const plotDiv = document.getElementById('plot');
    const idx = findTraceIndexByMeta('USER_POINT');
    const nameText = `VOC=${voc.toFixed(2)}, NOX=${nox.toFixed(2)}`;
    if (idx >= 0) {
      return Plotly.restyle(plotDiv, { x: [[x]], y: [[y]], name: [[nameText]], 'marker.color': [['red']], 'marker.size': [[12]], 'marker.symbol': [['diamond']] }, [idx]);
    } else {
      const trace = { x: [x], y: [y], mode: 'markers', name: nameText, marker: { color: 'red', size: 12, symbol: 'diamond' }, meta: 'USER_POINT' };
      return Plotly.addTraces(plotDiv, [trace]);
    }
  }
  function upsertEstimateCornerTrace(corner) {
    if (!corner) return Promise.resolve();
    const plotDiv = document.getElementById('plot');
    const idx = findTraceIndexByMeta('EST_CORNER');
    if (idx >= 0) {
      return Plotly.restyle(plotDiv, { x: [[corner.x]], y: [[corner.y]], 'marker.color': [['blue']], 'marker.size': [[2]], 'marker.symbol': [['circle']] }, [idx]);
    } else {
      const trace = { x: [corner.x], y: [corner.y], mode: 'markers', name: '估算位置', marker: { color: 'blue', size: 2, symbol: 'circle' }, meta: 'EST_CORNER' };
      return Plotly.addTraces(plotDiv, [trace]);
    }
  }
  function annotateInputAndEstimate(x, y, voc, nox) {
    const plotDiv = document.getElementById('plot');
    const text = `24NOX=${x.toFixed(2)}<br>M1M1O3=${y.toFixed(2)}<br>VOC≈${voc.toFixed(2)}<br>NOx≈${nox.toFixed(2)}`;
    const ann = { x, y, xref: 'x', yref: 'y', text, showarrow: false, xshift: 14, yshift: 14, xanchor: 'left', yanchor: 'bottom', align: 'left', font: { color: 'red', size: 13 }, bgcolor: 'rgba(255,255,255,0.85)', bordercolor: 'rgba(0,0,0,0.15)', borderwidth: 1, borderpad: 6 };
    return Plotly.relayout(plotDiv, { annotations: [ann] });
  }

  // ===== 对外：按钮点击 =====
  window.plotUserPoint = function (levels = 8) {
    const x = parseFloat(document.getElementById('userX')?.value);
    const y = parseFloat(document.getElementById('userY')?.value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { alert('请输入有效的数字 X 和 Y'); return; }
    if (!isGridReady()) { alert('TEKMA 网格尚未准备好，请稍后重试'); initGridFromCSV(); return; }

    ensurePlotInitialized()
      .then(() => {
        const res = estimateFromXY(x, y, levels);
        if (!res.ok) {
          alert('输入点不在有效范围内（不属于任何初始四边形）。请检查 24NOX/M1M1O3 是否落在图内网格覆盖范围。');
          return null;
        }
        return upsertUserTraceSquare(x, y, res.estimate.VOC, res.estimate.NOX)
          .then(() => upsertEstimateCornerTrace(res.chosenCorner))
          .then(() => annotateInputAndEstimate(x, y, res.estimate.VOC, res.estimate.NOX))
          .then(() => res);
      })
      .then(res => { if (res) console.log('[estimate] 结果：', res); })
      .catch(err => console.error('[position] 绘制/估算失败：', err));
  };

  // 页面加载时初始化网格一次
  document.addEventListener('DOMContentLoaded', function () {
    initGridFromCSV();
  });
})();
