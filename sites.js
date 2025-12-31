document.addEventListener("DOMContentLoaded", function () {
  const plotDiv = document.getElementById('plot');

  function ensurePlotInitialized() {
    if (plotDiv && plotDiv._fullData) return Promise.resolve();
    const baseLayout = {
      title: 'T-EKMA曲线与用户数据点及站点标注',
      xaxis: { title: 'X', gridcolor: '#eee' },
      yaxis: { title: 'Y', gridcolor: '#eee' },
      legend: { orientation: "h", x: 0, y: 1.08 },
      plot_bgcolor: "#fafafa",
      uirevision: 'bg'
    };
    return Plotly.newPlot(plotDiv, [], baseLayout, { responsive: true });
  }

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

  ensurePlotInitialized()
    .then(() => addSitesTrace())
    .then(() => console.log('[sites] 站点数据已添加'))
    .catch(err => console.error('[sites] 站点数据添加失败：', err));
});
