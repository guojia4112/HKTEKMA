// ==== 调试日志（确认文件已加载） ====
console.log('[tekma.js] loaded at', new Date().toISOString());

document.addEventListener("DOMContentLoaded", function () {
  const plotDiv = document.getElementById('plot');

  // 颜色映射（按 VOC 值生成色彩）：蓝->红
  function colorForVOC(voc, vocMin, vocMax) {
    const t = (voc - vocMin) / Math.max(1e-9, (vocMax - vocMin)); // 0..1
    const hue = 240 - 240 * t;
    return `hsl(${Math.round(hue)}, 70%, 50%)`;
  }

  // 灰色虚线样式（NOX 曲线）
  const grayLine = { color: '#8a8a8a', width: 1.0, dash: 'dot'};

  // 读取 CSV（加时间戳绕缓存）
  Papa.parse('data/TEKMA.csv?v=' + Date.now(), {
    download: true,
    header: true,         // 第1行是表头
    dynamicTyping: true,  // 数字自动转为 number
    skipEmptyLines: true,
    complete: function (results) {
      const rows = results.data; // 期望 1050 条数据（不含表头）
      console.log('[TEKMA parse] fields:', results.meta?.fields);
      console.log('[TEKMA parse] rows length:', rows?.length);
      console.log('[TEKMA parse] errors:', results.errors);

      if (!rows || rows.length === 0) {
        Plotly.newPlot(plotDiv, [], { title: 'TEKMA.csv 为空或解析失败' });
        return;
      }

      // --- 预处理：剔除非数值行，并收集范围 ---
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      const cleanRows = [];
      for (const r of rows) {
        const voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
        if ([voc, nox, x, y].some(v => typeof v !== 'number' || isNaN(v))) continue;
        cleanRows.push({ VOC: voc, NOX: nox, X: x, Y: y });
        xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
        ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
      }
      if (cleanRows.length === 0) {
        Plotly.newPlot(plotDiv, [], { title: '没有有效数据点' });
        return;
      }

      // --- 分组 A：按 VOC 分组（VOC 等值线，沿 NOX 连线，彩色实线） ---
      const byVOC = new Map(); // key: VOC -> [{NOX, X, Y}]
      for (const r of cleanRows) {
        if (!byVOC.has(r.VOC)) byVOC.set(r.VOC, []);
        byVOC.get(r.VOC).push({ NOX: r.NOX, X: r.X, Y: r.Y });
      }
      const vocValues = Array.from(byVOC.keys()).sort((a,b) => a - b);
      const vocMin = vocValues[0], vocMax = vocValues[vocValues.length - 1];

      const vocTraces = vocValues.map(voc => {
        const arr = byVOC.get(voc).sort((a,b) => a.NOX - b.NOX); // 沿 NOX 递增连线
        const xs = arr.map(p => p.X);
        const ys = arr.map(p => p.Y);
        return {
          x: xs,
          y: ys,
          mode: 'lines',
          name: `VOC=${voc}`,                 // 图例显示 VOC 值
          line: { color: colorForVOC(voc, vocMin, vocMax), width: 2.2 },
          hovertemplate: `VOC=${voc}<br>24NOX: %{x}<br>M1M1O3: %{y}<extra></extra>`,
          legendgroup: 'VOC',
          showlegend: true
        };
      });

      // --- 分组 B：按 NOX 分组（NOX 等值线，沿 VOC 连线，灰色虚线） ---
      const byNOX = new Map(); // key: NOX -> [{VOC, X, Y}]
      for (const r of cleanRows) {
        if (!byNOX.has(r.NOX)) byNOX.set(r.NOX, []);
        byNOX.get(r.NOX).push({ VOC: r.VOC, X: r.X, Y: r.Y });
      }
      const noxValues = Array.from(byNOX.keys()).sort((a,b) => a - b);

      const noxTraces = noxValues.map(nox => {
        const arr = byNOX.get(nox).sort((a,b) => a.VOC - b.VOC); // 沿 VOC 递增连线
        const xs = arr.map(p => p.X);
        const ys = arr.map(p => p.Y);
        return {
          x: xs,
          y: ys,
          mode: 'lines',
          name: `NOX=${nox}`,                 // 图例显示 NOX 值
          line: grayLine,                     // 灰色虚线
          hovertemplate: `NOX=${nox}<br>24NOX: %{x}<br>M1M1O3: %{y}<extra></extra>`,
          legendgroup: 'NOX',
          showlegend: false                   // 默认不占图例空间；需要可改成 true
        };
      });

      // --- 合并两类曲线并绘图 ---
      const traces = [...noxTraces, ...vocTraces]; // 灰线在底层，彩线覆盖在上层
      const layout = {
        title: 'T‑EKMA 背景图（VOC 等值线：彩色；NOX 等值线：灰色虚线）',
        xaxis: { title: '24NOX (X)', gridcolor: '#eee' /*, range: [xmin, xmax]*/ },
        yaxis: { title: 'M1M1O3 (Y)', gridcolor: '#eee' /*, range: [ymin, ymax]*/ },
        plot_bgcolor: '#fafafa',
        legend: { orientation: 'v', x: 1.02, y: 0.5 },
		margin: { l: 60, r: 160, t: 60, b: 60 }
      };

      Plotly.newPlot(plotDiv, traces, layout, { responsive: true });
    },
    error: function (err, file, inputElem, reason) {
      console.error('[TEKMA parse] ERROR:', err, reason);
      Plotly.newPlot(plotDiv, [], { title: 'TEKMA.csv 加载失败' });
    }
  });
});
``
