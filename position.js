// UI 层（ES module） — 只负责：读取用户输入、调用 alg/locator 的接口、绘图展示
// 请在 index.html 中以 <script type="module" src="position.js"></script> 引入
import { initGridFromCSV, isGridReady, estimateFromXY } from './alg/locator.js';

// ===== 绘图相关（保留原逻辑） =====
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

// ===== 对外：按钮点击（只负责输入/调用/展示） =====
window.plotUserPoint = function (levels = 8) {
  // 从页面读取用户输入（24NOX, M1M1O3）
  const x = parseFloat(document.getElementById('userX')?.value);
  const y = parseFloat(document.getElementById('userY')?.value);
  if (!Number.isFinite(x) || !Number.isFinite(y)) { alert('请输入有效的数字 X 和 Y'); return; }

  if (!isGridReady()) {
    alert('TEKMA 网格尚未准备好，请稍后重试');
    // 触发 alg 内部去加载 CSV（alg/locator.js 负责实际加载）
    initGridFromCSV().catch(err => console.error('[position] 初始化网格失败：', err));
    return;
  }

  ensurePlotInitialized()
    .then(() => {
      const res = estimateFromXY(x, y, levels);
      if (!res.ok) {
        alert('输入点不在有效范围内（不属于任何初始四边形）。请检查 24NOX/M1M1O3 是否落在图内网格覆盖范围。');
        console.warn('[position] estimate failed:', res);
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

// 页面加载时，调用 alg 的 init（CSV 加载在 alg 内部处理）
document.addEventListener('DOMContentLoaded', function () {
  // 这里调用 alg 提供的 initGridFromCSV，以便算法模块完成 CSV 加载与网格构建
  initGridFromCSV().catch(err => console.error('[position] 初始化网格失败：', err));
});