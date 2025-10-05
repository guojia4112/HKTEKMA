document.addEventListener("DOMContentLoaded", function () {
    const plotDiv = document.getElementById('plot');
    let userPoints = [];

    window.plotUserPoint = function () {
        let x = parseFloat(document.getElementById('userX').value);
        let y = parseFloat(document.getElementById('userY').value);
        if (!isNaN(x) && !isNaN(y)) {
            userPoints.push({ x: x, y: y });
            drawUserPoints();
        } else {
            alert("请输入有效的X和Y值！");
        }
    };

    function drawUserPoints() {
        Plotly.addTraces(plotDiv, {
            x: userPoints.map(p => p.x),
            y: userPoints.map(p => p.y),
            mode: 'markers',
            name: '你输入的数据点',
            marker: { color: 'red', size: 12, symbol: 'diamond' }
        });
    }

    Papa.parse('data/NOXO3.csv', {
        download: true,
        header: true,
        complete: function (res) {
            const csvData = res.data;
            const xValues = csvData.map(row => parseFloat(row.NOX));
            const yValues = csvData.map(row => parseFloat(row.O3));
            const siteNames = csvData.map(row => row.site);

            Plotly.addTraces(plotDiv, {
                x: xValues,
                y: yValues,
                mode: 'markers+text',
                type: 'scatter',
                text: siteNames,
                textposition: 'top center',
                name: '站点数据',
                marker: { color: 'blue', size: 10 }
            });
        }
    });
});
