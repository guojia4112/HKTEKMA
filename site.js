document.addEventListener("DOMContentLoaded", function () {
    const plotDiv = document.getElementById('plot');
    let userPoints = [];

    // 用户输入点逻辑
    window.plotUserPoint = function () {
        let x = parseFloat(document.getElementById('userX').value);
        let y = parseFloat(document.getElementById('userY').value);
        if (!isNaN(x) && !isNaN(y)) {
            userPoints.push({ x: x, y: y });
            Plotly.addTraces(plotDiv, {
                x: userPoints.map(p => p.x),
                y: userPoints.map(p => p.y),
                mode: 'markers',
                name: '你输入的数据点',
                marker: { color: 'red', size: 12, symbol: 'diamond' }
            });
        } else {
            alert("请输入有效的X和Y值！");
        }
    };

    // 从在线链接获取站点 66 数据并绘制
    fetch('https://www.aqhi.gov.hk/js/data/past_24_pollutant.js')
        .then(response => response.text())
        .then(scriptText => {
            const match = scriptText.match(/var station_24_data = (\[.*\]);/);
            if (!match) {
                console.error('无法解析 station_24_data');
                return;
            }

            const stationDataArray = JSON.parse(match[1]);
            const station66Array = stationDataArray.find(arr => arr.some(item => item.StationID === '66'));
            if (!station66Array) {
                console.error('未找到站点 66 数据');
                return;
            }

            const noxValues = station66Array.map(item => parseFloat(item.NO2));
            const o3Values = station66Array.map(item => parseFloat(item.O3));
            const timeLabels = station66Array.map(item => item.DateTime);

            Plotly.addTraces(plotDiv, {
                x: noxValues,
                y: o3Values,
                mode: 'markers+text',
                type: 'scatter',
                text: timeLabels,
                textposition: 'top center',
                name: '站点66过去24小时',
                marker: { color: 'green', size: 10 }
            });
        })
        .catch(err => console.error('获取数据失败:', err));
});
