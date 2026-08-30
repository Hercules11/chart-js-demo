# chart-js-demo — Chart.js 图表 Demo 架构文档

## 1. 项目简介与技术栈

学习 Chart.js 时按官方教程实现的图表 demo（写 typing-faster 期间的研究产物）：
从 Cube.js 云端 API（MoMA 艺术品公开数据集）拉取聚合数据，
分别渲染两张图表 —— 逐年「Acquisitions 收藏数量」柱状图、
艺术品宽高分布气泡图（含自定义 `chartAreaBorder` 插件）。

- 技术栈：
  - Chart.js 4（按需 `import { Chart, ... }` + `Chart.register(...)`，
    而非体积更大的 `chart.js/auto`）
  - `@cubejs-client/core`（Cube.js 数据查询客户端）
  - Parcel 2 作为打包构建工具（devDependencies）
- 文件结构（忽略 dist / node_modules）：

```
chart-js-demo/
    package.json          scripts: dev / build
    src/
        index.html        页面（两个 canvas: #dimensions / #acquisitions）
        api.js            Cube.js 客户端封装，导出两个查询函数
        acquisitions.js   柱状图逻辑（异步 IIFE）
        dimensions.js     气泡图逻辑 + chartAreaBorder 自定义插件
    dist/                 Parcel 构建产物（本文档忽略）
```

- 运行方式：
  - 开发：`pnpm install` 后 `pnpm dev`（即 `parcel src/index.html`），访问
    Parcel 输出的开发地址
  - 构建：`pnpm build`（`parcel build src/index.html --public-url /chart-js-demo/`，
    public-url 面向 GitHub Pages 子路径部署）
  - 注意：数据来自远程 Cube Cloud API 且 JWT token 内置于 api.js，
    需联网；token 已过期则接口失效

## 2. 系统架构图

```
+-----------------------------+
|        src/index.html       |
|  <canvas #dimensions>       |<--- dimensions.js (module)
|  <canvas #acquisitions>     |<--- acquisitions.js (module)
+-----------------------------+
        |                          |
        | 两个入口脚本相互独立，各自执行异步 IIFE
        v                          v
+--------------------------+  +--------------------------+
| dimensions.js            |  | acquisitions.js          |
| Chart.register(          |  | Chart.register(          |
|   BarController,         |  |   BubbleController,      |
|   BarElement, ...)       |  |   PointElement, ...)     |
| new Chart(#dimensions,   |  | new Chart(#acquisitions, |
|   type:'bubble')         |  |   type:'bar')            |
+-----------+--------------+  +-----------+--------------+
            |  await getDimensions()       | await getAcquisitionsByYear()
            v                              v
      +----------------------------------------------------+
      |                 api.js (共享模块)                    |
      |  CubejsApi(cubeToken, { apiUrl })                  |
      |  apiUrl: https://heavy-lansford.gcp-us-central1.   |
      |          cubecloudapp.dev/cubejs-api/v1            |
      +-------------------------+--------------------------+
                                | cubeApi.load(query)  (HTTP)
                                v
                    +------------------------+
                    | Cube Cloud (MoMA 数据集) |
                    | Artworks cube          |
                    +------------------------+
```

## 3. 数据流图

**柱状图数据流（acquisitions.js）**

```
查询对象 acquisitionsByYearQuery:
  dimensions: ["Artworks.yearAcquired"]
  measures:   ["Artworks.count"]
  filters:    [{ member, operator:'set' }]
  order:      { yearAcquired: 'asc' }
        |
        v
cubeApi.load(query) ---> resultSet (ResultSet 对象)
        |
        v
resultSet.tablePivot() ---> 行数组（列名 -> 值）
        |
        v
map(row => ({ year: parseInt(row['Artworks.yearAcquired']),
              count: parseInt(row['Artworks.count']) }))
        |--- 输出: [{ year: number, count: number }, ...]
        v
new Chart(#acquisitions, { type: 'bar',
        data: { labels: data.map(row => row.year),
                datasets: [{ label: "Acquisitions by year",
                             data: data.map(row => row.count) }] },
        options: { animation:false, legend 关闭, tooltip 开启 } })
        |
        v
渲染: 800px 宽的柱状图 canvas
```

**气泡图数据流（dimensions.js）**

```
查询对象 dimensionsQuery:
  dimensions: [Artworks.widthCm, Artworks.heightCm], measures: [Artworks.count]
  filters: classification = 'Painting'、宽高 set 且 < 500
        |
        v
cubeApi.load(query) ---> resultSet.tablePivot() --->
        |--- 输出: [{ width: number, height: number, count: number }, ...]
        v
三个 datasets 按 width/height 关系过滤:
  'width = height' / 'width > height' / 'width < height'
  每条数据映射为 { x: width, y: height, r: count }   (x,y 为坐标, r 为半径)
        |
        v
new Chart(#dimensions, { type:'bubble',
        plugins: [chartAreaBorder],   // 自定义插件: beforeDraw 画红色虚线边框
        options: { aspectRatio:1, x/y 轴 max:500, ticks: 值/100 显示为 'm' } })
        |
        v
渲染: 500px 宽的气泡图 canvas
```

## 4. 关键数据结构

**Acquisition 行**（`getAcquisitionsByYear` 返回的数组元素）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `year` | number | 收藏年份（`Artworks.yearAcquired`） |
| `count` | number | 该年收藏件数（`Artworks.count`） |

**Dimension 行**（`getDimensions` 返回的数组元素）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `width` | number | 画作宽（cm，`Artworks.widthCm`） |
| `height` | number | 画作高（cm，`Artworks.heightCm`） |
| `count` | number | 该尺寸的画作数量（映射为气泡半径 r） |

**Cube 查询对象**（传给 `cubeApi.load`）

| 字段 | 说明 |
| --- | --- |
| `dimensions` | string[]，Cube 数据模型的维度成员全名 |
| `measures` | string[]，聚合度量 |
| `filters` | `{ member, operator, values? }[]`，operator 含 'set' / 'equals' / 'lt' |
| `order` | `{ 成员名: 'asc' \| 'desc' }` |

**Chart.js 配置要点**

- `data.datasets[].data`：柱状图为 number[]；气泡图为 `{x, y, r}[]`
- `chartAreaBorder` 自定义插件对象：
  `{ id: 'chartAreaBorder', beforeDraw(chart, args, options) {...} }`，
  options 里配置 borderColor / borderWidth / borderDash / borderDashOffset

## 5. 接口/主要函数清单

**api.js（E:\past-toy-projects\chart-js-demo\src\api.js）**

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| `getAcquisitionsByYear` | `async () => { year:number, count:number }[]` | 构建 acquisitionsByYearQuery，`cubeApi.load` 后经 `tablePivot().map` 转为整数行数组 |
| `getDimensions` | `async () => { width:number, height:number, count:number }[]` | 构建 dimensionsQuery（限 Painting、宽高 <500），同样转换返回 |

模块级单例：`cubeApi = new CubejsApi(cubeToken, { apiUrl })`，
token 为硬编码 JWT（iat 1000000000 / exp 5000000000）。

**acquisitions.js**

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| 匿名异步 IIFE | `(async function(){...})()` | 注册 Chart.js 组件（Colors/BubbleController/CategoryScale/LinearScale/PointElement/Legend），await 数据后 `new Chart(document.getElementById('acquisitions'), {type:'bar', ...})`；文件开头保留了本地硬编码 year/count 数据的注释版本 |

**dimensions.js**

| 函数 | 签名 | 说明 |
| --- | --- | --- |
| 匿名异步 IIFE | `(async function(){...})()` | 注册 Chart.js 组件（BarController/BarElement 等，注释说明按需导入以减小产物体积），await 数据后渲染 bubble 图，含三组 datasets 过滤映射 |
| `chartAreaBorder.beforeDraw` | `(chart, args, options) => void` | 自定义插件钩子：从 `chart.chartArea` 取 left/top/width/height，用 ctx 画红色虚线矩形边框 |
| ticks callback | `(value) => `${value/100} m`` | x/y 轴刻度 cm 转 m 显示 |

注意点（代码事实）：

- dimensions.js 的 `data.labels` 映射用了 `data.map(x => x.year)`，但该接口
  返回的行没有 `year` 字段，labels 实际为 undefined 数组（对 bubble 图无实际影响）。
- 两个入口脚本各自独立注册 Chart.js 组件并请求数据，互不依赖。
