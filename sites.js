document.addEventListener("DOMContentLoaded", function () {
  const plotDiv = document.getElementById('plot');

  function addSitesTrace() {
    return new Promise((resolve, reject) => {
      Papa.parse('data/NOXO3.csv', {
        download: true,
        header: true,
        complete: function (res) {
          const csvData = res.data || [];
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

  function ensurePlotInitialized() {
    if (plotDiv && plotDiv._fullData) return Promise.resolve();
    // 只做基础初始化，不设置坐标轴标题（让 tekma.js 的设置保留）
    const baseLayout = {
      plot_bgcolor: "#fafafa",
      uirevision: 'bg'
    };
    return Plotly.newPlot(plotDiv, [], baseLayout, { responsive: true });
  }

  ensurePlotInitialized()
    .then(() => addSitesTrace())
    .then(() => console.log('[sites] 站点数据已添加'))
    .catch(err => console.error('[sites] 站点数据添加失败：', err));
});
