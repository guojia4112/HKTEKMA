// 纯算法模块（负责 CSV 加载并构建网格，以及估算接口）
// 不直接操作 DOM（仅在需要时将 grid 放到 window.TEKMA_GRID 以兼容旧代码）
// 使用方式（示例）:
//   import { initGridFromCSV, isGridReady, estimateFromXY } from './alg/locator.js';
//   await initGridFromCSV('data/TEKMA.csv'); // 可选传入 url
//   const ok = isGridReady(); // true/false
//   const res = estimateFromXY(60, 80, 8);

const DEFAULT_STEP_VOC = 0.5;
const DEFAULT_STEP_NOX = 1.0;

let _grid = null; // 内部网格状态

function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; }
function mid(a, b) { return { x: (a.x + b.x)/2, y: (a.y + b.y)/2, VOC: (a.VOC + b.VOC)/2, NOX: (a.NOX + b.NOX)/2 }; }
function centerOfQuad(A, B, C, D) {
  return {
    x: (A.x + B.x + C.x + D.x)/4,
    y: (A.y + B.y + C.y + D.y)/4,
    VOC: (A.VOC + B.VOC + C.VOC + D.VOC)/4,
    NOX: (A.NOX + B.NOX + C.NOX + D.NOX)/4
  };
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

// 将原先 buildGridFromRows 的逻辑封装；返回构建完成的 grid 对象
export function buildGridFromRows(rows, stepVoc = DEFAULT_STEP_VOC, stepNox = DEFAULT_STEP_NOX) {
  const map = new Map();
  let valid = 0;
  for (const r of rows) {
    const voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
    if ([voc, nox, x, y].every(v => typeof v === 'number' && !isNaN(v))) {
      const Vq = quantize(voc, stepVoc);
      const Nq = quantize(nox, stepNox);
      map.set(mkKey(Vq, Nq), { x, y, VOC: Vq, NOX: Nq });
      valid++;
    }
  }
  if (valid === 0) throw new Error('buildGridFromRows: no valid rows');
  return { stepVoc, stepNox, map, key: mkKey };
}

// 初始化网格：加载 CSV（默认 'data/TEKMA.csv'），返回 Promise，resolve 后网格可用
export function initGridFromCSV(url = 'data/TEKMA.csv') {
  return new Promise((resolve, reject) => {
    // 如果已经准备好直接 resolve
    if (_grid && _grid.map instanceof Map && _grid.map.size > 0) {
      return resolve(_grid);
    }
    if (typeof Papa === 'undefined') {
      const err = new Error('initGridFromCSV: PapaParse 未加载');
      console.error(err);
      return reject(err);
    }
    Papa.parse(url, {
      download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: function (results) {
        const rows = results.data || [];
        try {
          const grid = buildGridFromRows(rows, DEFAULT_STEP_VOC, DEFAULT_STEP_NOX);
          _grid = grid;
          // 兼容旧代码：把网格放到 window 下
          try { window.TEKMA_GRID = grid; } catch (e) { /* ignore if no window */ }
          console.log('[alg/locator] TEKMA 网格已构建，节点数:', grid.map.size);
          resolve(grid);
        } catch (err) {
          console.error('[alg/locator] 构建网格失败:', err);
          reject(err);
        }
      },
      error: function (err) {
        console.error('[alg/locator] CSV 加载失败:', err);
        reject(err);
      }
    });
  });
}

export function isGridReady() {
  return !!(_grid && _grid.map instanceof Map && _grid.map.size > 0);
}

// 内部：按当前 _grid 查询（带宽容回退）
function gridGet(voc, nox) {
  if (!_grid || !(_grid.map instanceof Map)) return null;
  const Vq = quantize(voc, _grid.stepVoc); const Nq = quantize(nox, _grid.stepNox);
  const key = (typeof _grid.key === 'function') ? _grid.key(Vq, Nq) : mkKey(Vq, Nq);
  let g = _grid.map.get(key);
  if (g) return { x: g.x, y: g.y, VOC: g.VOC, NOX: g.NOX };
  const tolV = _grid.stepVoc / 2 + 1e-9, tolN = _grid.stepNox / 2 + 1e-9;
  let best = null, bestCost = Infinity;
  _grid.map.forEach((val) => {
    const dvv = Math.abs(val.VOC - voc), dnn = Math.abs(val.NOX - nox);
    if (dvv <= tolV && dnn <= tolN) {
      const cost = dvv*dvv + dnn*dnn;
      if (cost < bestCost) { bestCost = cost; best = val; }
    }
  });
  return best ? { x: best.x, y: best.y, VOC: best.VOC, NOX: best.NOX } : null;
}

function findNearestGridPointByXY(x, y) {
  if (!_grid || !(_grid.map instanceof Map)) return null;
  let best = null, bestD2 = Infinity;
  _grid.map.forEach((val) => {
    const d2 = dist2(x, y, val.x, val.y);
    if (d2 < bestD2) { bestD2 = d2; best = { x: val.x, y: val.y, VOC: val.VOC, NOX: val.NOX }; }
  });
  return best;
}

function buildAdjacentQuads(center) {
  const dv = _grid?.stepVoc ?? DEFAULT_STEP_VOC;
  const dn = _grid?.stepNox ?? DEFAULT_STEP_NOX;
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

export function chooseQuadContainingPoint(quads, userXY, options = { allowFallback: true }) {
  if (!quads || !quads.length) return null;
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

export function subdivideQuad(A, B, C, D) {
  const AB = mid(A, B), BC = mid(B, C), CD = mid(C, D), DA = mid(D, A);
  const M  = centerOfQuad(A, B, C, D);
  return [
    [A,  AB, M,  DA],
    [AB, B,  BC, M ],
    [M,  BC, C,  CD],
    [DA, M,  CD, D ]
  ];
}

export function refineToLevel(initialQuad, userXY, levels = 8) {
  let q = initialQuad;
  for (let lvl = 0; lvl < levels; lvl++) {
    const subs = subdivideQuad(q[0], q[1], q[2], q[3]);
    const chosen = chooseQuadContainingPoint(subs, userXY, { allowFallback: true });
    q = chosen || subs[0];
  }
  return q;
}

// 供外部调用：使用内部 _grid 完成估算
export function estimateFromXY(userX, userY, levels = 8) {
  if (!isGridReady()) {
    return { ok: false, reason: 'TEKMA 网格未准备好' };
  }
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

// 额外导出以便调试或单元测试
export default {
  initGridFromCSV,
  isGridReady,
  estimateFromXY,
  buildGridFromRows
};