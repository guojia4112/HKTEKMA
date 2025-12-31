<script>
document.addEventListener("DOMContentLoaded", function () {
  const plotDiv = document.getElementById('plot');

  function getColor(idx, total) {
    return `hsl(${Math.round(360 * idx / Math.max(1,total))}, 65%, 55%)`;
  }

  // 读取 4 列结构：VOC, NOX, 24NOX, M1M1O3
  Papa.parse('data/TEKMA.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    complete: function (results) {
      const rows = results.data; // 每行一个对象：{VOC, NOX, 24NOX, M1M1O3}

      // 1) 按 NOX 分组
      const byNOX = new Map(); // key: NOX 值, value: [{VOC, x, y}]
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const VOC = r.VOC;
        const NOX = r.NOX;
        const x = r['24NOX'];
        const y = r['M1M1O3'];
        // 跳过缺失或非数值
        if ([VOC, NOX, x, y].some(v => typeof v !== 'number' || isNaN(v))) continue;
        if (!byNOX.has(NOX)) byNOX.set(NOX, []);
        byNOX.get(NOX).push({ VOC, x, y });
      }

      // 2) 对每个 NOX 组按 VOC 升序
      const noxValues = Array.from(byNOX.keys()).sort((a,b) => a - b);

      // 3) 生成 Plotly 曲线
      const traces = [];
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;

      noxValues.forEach((nox, k) => {
        const arr = byNOX.get(nox);
        arr.sort((a,b) => a.VOC - b.VOC);

        const xs = arr.map(p => p.x); // 24NOX
        const ys = arr.map(p => p.y); // M1M1O3

        xs.forEach(x => { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); });
        ys.forEach(y => { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); });

        traces.push({
          x: xs,
          y: ys,
          mode: 'lines',
          name: `NOX=${nox}`,
          line: { color: getColor(k, noxValues.length), width: 2 },
          hovertemplate: `NOX=${nox}<br>24NOX: %{x}<br>M1M1O3: %{y}<extra></extra>`
        });
      });

      // 4) 绘图
      const layout = {
        title: 'T-EKMA 背景图（按 NOX 分组，沿 VOC 连线）',
        xaxis: { title: '24NOX (X)', gridcolor: '#eee' },
        yaxis: { title: 'M1M1O3 (Y)', gridcolor: '#eee' },
        legend: { orientation: 'h', x: 0, y: 1.08 },
        plot_bgcolor: '#fafafa'
        // 如需固定范围，可加：
        // , xaxis: { title: '24NOX (X)', gridcolor: '#eee', range: [xmin, xmax] }
        // , yaxis: { title: 'M1M1O3 (Y)', gridcolor: '#eee', range: [ymin, ymax] }
      };

      Plotly.newPlot(plotDiv, traces, layout, { responsive: true });
    }
  });
});
</script>
