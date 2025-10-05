document.addEventListener("DOMContentLoaded", function () {
    const plotDiv = document.getElementById('plot');

    function getColor(idx, total) {
        return `hsl(${Math.round(360 * idx / total)}, 65%, 55%)`;
    }

    Papa.parse('data/TEKMADATA.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        complete: function (results) {
            const data = results.data;
            const columns = results.meta.fields;

            let curveNames = [];
            for (let i = 0; i < columns.length; i += 2) {
                if (columns[i + 1]) {
                    curveNames.push([columns[i], columns[i + 1]]);
                }
            }

            let traces = [];
            for (let k = 0; k < curveNames.length; k++) {
                let colX = curveNames[k][0];
                let colY = curveNames[k][1];
                let xArr = [];
                let yArr = [];
                for (let i = 0; i < data.length; i++) {
                    let x = data[i][colX];
                    let y = data[i][colY];
                    if (typeof x === "number" && typeof y === "number" && !isNaN(x) && !isNaN(y)) {
                        xArr.push(x);
                        yArr.push(y);
                    }
                }
                traces.push({
                    x: xArr,
                    y: yArr,
                    mode: 'lines',
                    name: `${colX.replace('X','')}`,
                    line: { color: getColor(k, curveNames.length), width: 2 }
                });
            }

            Plotly.newPlot(plotDiv, traces, {
                title: 'T-EKMA背景图',
                xaxis: { title: 'X', gridcolor: '#eee' },
                yaxis: { title: 'Y', gridcolor: '#eee' },
                legend: { orientation: "h", x: 0, y: 1.08 },
                plot_bgcolor: "#fafafa"
            }, { responsive: true });
        }
    });
});
