// sites.js — 只追加/更新，不 newPlot；不动 tekma 背景
document.addEventListener("DOMContentLoaded", function () {
  const plotDiv = document.getElementById('plot');
  let userPoints = [];

  function ensurePlotInitialized() {
    if (plotDiv && plotDiv._fullData) return Promise.resolve();
    const baseLayout = {
      title: 'T-EKMA曲线与用户数据点及站点标注',
      xaxis: { title: 'X', gridcolor: '#eee' },
      yaxis: { title: 'Y', gridcolor: '#eee' },
      legend: { orientation: "h", x: 0, y: 1.08 },
      plot_bgcolor: "#fafafa"
    };
    return Plotly.newPlot(plotDiv, [], baseLayout, { responsive: true });
  }

  function deleteSitesTraces() {
    if (!plotDiv || !plotDiv._fullData) return Promise.resolve();
    const indices = [];
    for (let i = 0; i < plotDiv.data.length; i++) {
      const tr = plotDiv.data[i];
      if (tr && tr.meta === 'SITES') indices.push(i);
    }
    return indices.length ? Plotly.deleteTraces(plotDiv, indices) : Promise.resolve();
  }

  function upsertUserPointsTrace() {
    let userIdx = -1;
    if (plotDiv && plotDiv._fullData) {
      for (let i = 0; i < plotDiv.data.length; i++) {
        const tr = plotDiv.data[i];
        if (tr && tr.meta === 'SITES_USER') { userIdx = i; break; }
      }
    }
    const xArr = userPoints.map(p => p.x);
    const yArr = userPoints.map(p => p.y);

    if (userIdx >= 0) {
      // 更新已有用户点轨迹
      return Plotly.update(plotDiv, { x: [xArr], y: [yArr] }, {}, [userIdx]);
    } else {
      // 新增用户点轨迹
      return Plotly.addTraces(plotDiv, {
        x: xArr,
        y: yArr,
        mode: 'markers',
        name: '你输入的数据点',
        marker: { color: 'red', size: 12, symbol: 'diamond' },
        meta: 'SITES_USER'
      });
    }
  }

  function addSitesTrace() {
    return new Promise((resolve, reject) => {
      Papa.parse('data/NOXO3.csv', {
        download: true,
        header: true,
        complete: function (res) {
          const csvData = res.data;
          const xValues = csvData.map(row => parseFloat(row.NOX));
          const yValues = csvData.map(row => parseFloat(row.O3));
          const siteNames = csvData.map(row => row.site);

          const trace = {
            x: xValues,
            y: yValues,
            mode: 'markers+text',
            type: 'scatter',
            text: siteNames,
            textposition: 'top center',
            name: '站点数据',
            marker: { color: 'blue', size: 10 },
            meta: 'SITES'
          };
          resolve(Plotly.addTraces(plotDiv, trace));
        },
        error: reject
      });
    });
  }

  function initSitesLayer() {
    ensurePlotInitialized()
      .then(() => addSitesTrace())       // 叠加站点数据
      .then(() => upsertUserPointsTrace()) // 确保有用户点轨迹（初始可为空）
      .then(() => console.log('[sites] 初始化完成'))
      .catch(err => console.error('[sites] 初始化失败：', err));
  }

  // 只更新用户点（按钮入口），不会动背景
  window.plotUserPoint = function () {
    const x = parseFloat(document.getElementById('userX').value);
    const y = parseFloat(document.getElementById('userY').value);
    if (!isNaN(x) && !isNaN(y)) {
      userPoints = [{ x, y }];
      ensurePlotInitialized()
        .then(() => upsertUserPointsTrace())
        .catch(err => console.error('[sites] 更新用户点失败：', err));
    } else {
      alert("请输入有效的X和Y值！");
    }
  };

  // 如果你将来要“重载” SITES 层（比如 NOXO3.csv 改了），只删本层再重加：
  window.reloadSitesLayer = function () {
    ensurePlotInitialized()
      .then(() => deleteSitesTraces())
      .then(() => addSitesTrace())
      .then(() => upsertUserPointsTrace())
      .then(() => console.log('[sites] 已重载 SITES 层'))
      .catch(err => console.error('[sites] 重载失败：', err));
  };

  // 初次加载
  initSitesLayer();
});
