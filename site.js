let userPoints = [];

function plotUserPoint() {
    let x = parseFloat(document.getElementById('userX').value);
    let y = parseFloat(document.getElementById('userY').value);
    if (!isNaN(x) && !isNaN(y)) {
        userPoints.push({ x: x, y: y });
        Plotly.addTraces('plot', {
            x: userPoints.map(p => p.x),
            y: userPoints.map(p => p.y),
            mode: 'markers',
            name: '你输入的数据点',
            marker: { color: 'red', size: 12, symbol: 'diamond' }
        });
    } else {
        alert("请输入有效的NO₂和O₃值！");
    }
}

document.addEventListener("DOMContentLoaded", function () {
    fetch('./data/past_24_pollutant.js')
        .then(response => response.text())
        .then(scriptText => {
            const script = document.createElement('script');
            script.textContent = scriptText;
            document.body.appendChild(script);

            if (typeof station_24_data === 'undefined') {
                console.error('station_24_data 未定义');
                return;
            }

            const station66Array = station_24_data.find(arr =>
                arr.some(item => item.StationID === '66')
            );

            if (!station66Array) {
                console.error('未找到站点 66 数据');
                return;
            }

            const no2Values = station66Array.map(item => parseFloat(item.NO2)).filter(v => !isNaN(v));
            const o3Values = station66Array.map(item => parseFloat(item.O3)).filter(v => !isNaN(v));
            const timeLabels = station66Array.map(item => item.DateTime);

            Plotly.addTraces('plot', {
                x: no2Values,
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
