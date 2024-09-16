// import Chart from 'chart.js/auto' // 导入所有的包，导致体积偏大
import { getDimensions } from './api'
// 按需导入，并且注册，减少打包产产物的体积
import {
    Chart,
    Colors,
    BarController,
    CategoryScale,
    LinearScale,
    BarElement,
    Legend
} from 'chart.js'

Chart.register(
    Colors,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Legend
);


(async function () {
    const data = await getDimensions();

    const chartAreaBorder = {
        id: 'chartAreaBorder',

        beforeDraw(chart, args, options) {
            const { ctx, chartArea: { left, top, width, height } } = chart;

            ctx.save();
            ctx.strokeStyle = options.borderColor;
            ctx.lineWidth = options.borderWidth;
            ctx.setLineDash(options.borderDash || []);
            ctx.lineDashOffset = options.borderDashOffset;
            ctx.strokeRect(left, top, width, height);
            ctx.restore();
        }
    };


    // 三个维度的数据，x, y, radius
    new Chart(
        document.getElementById('dimensions'),
        {
            type: 'bubble',
            plugins: [chartAreaBorder],
            options: {
                plugins: {
                    chartAreaBorder: {
                        borderColor: 'red',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        borderDashOffset: 2,
                    }
                },
                aspectRatio: 1,
                scales: {
                    x: {
                        max: 500,
                        ticks: {
                            callback: value => `${value / 100} m`,
                        }
                    },
                    y: {
                        max: 500,
                        ticks: {
                            callback: value => `${value / 100} m`,
                        }
                    }
                }
            },
            data: {
                labels: data.map(x => x.year),
                datasets: [
                    {
                        label: 'width = height',
                        data: data
                            .filter(row => row.width === row.height)
                            .map(row => ({
                                x: row.width,
                                y: row.height,
                                r: row.count
                            }))
                    },
                    {
                        label: 'width > height',
                        data: data
                            .filter(row => row.width > row.height)
                            .map(row => ({
                                x: row.width,
                                y: row.height,
                                r: row.count
                            }))
                    },
                    {
                        label: 'width < height',
                        data: data
                            .filter(row => row.width < row.height)
                            .map(row => ({
                                x: row.width,
                                y: row.height,
                                r: row.count
                            }))
                    }
                ]
            }
        }
    );
})();
