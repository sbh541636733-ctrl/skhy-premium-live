# BASIS — 跨交易所实时溢价

GitHub Pages 静态网站：https://sbh541636733-ctrl.github.io/skhy-premium-live/

支持 Hyperliquid（含 HIP-3）、OKX、Binance、Gate、Bybit、Bitget 的现货与永续市场。市场目录从交易所读取，CEX 以 USDT / USDC 稳定币计价市场为主，Bitget / Gate 永续为 USDT 市场。搜索保留原始合约符号，不自动把包装币、1000 倍合约或同名代币视为相同资产。

- 中间价溢价：`(B_mid × ratio × fx / A_mid − 1) × 100%`
- 买 A / 卖 B 盘口价差：`(B_bid × ratio × fx / A_ask − 1) × 100%`，不含费用或深度滑点。
- WebSocket 推送；若推送超过 5 秒未更新，启用 5 秒 REST 轮询，自动重连。
- 报价接收超过 30 秒、源时间超过 45 秒或两边时间相差超过 15 秒时暂停溢价计算。没有源时间戳的接口明确使用接收时间。
- 历史精确匹配两边已收盘 K 线的 UTC 开盘时间，不向前填充，缺失周期留空；1D / 7D / 30D / 90D 分别使用 5m / 1h / 4h / 1d。
- 历史汇率采用界面当前手动值，非历史 FX 回测；USD / USDT / USDC 默认按 1 比较。
- 实时曲线仅保留当前监控期间最多 1,200 个有效点（每 3 秒最多一个）。
- 原 SKHX / SKHY 组合保留 10 倍换算快捷入口；这一比率属于组合设置，不是其他合约的默认比率。

本地运行：`python -m http.server 8765`。无需打包或 API Key。向 main 推送后，现有 GitHub Actions 自动部署。

## 文件

- `adapters.js`：市场目录、盘口、统计、历史 K 线及 WebSocket 适配。
- `app.js`：选择器、报价时效检查、溢价计算、Canvas 图与交互。
- `index.html` / `styles.css`：页面结构与响应式样式。

## 官方接口文档

- https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
- https://www.okx.com/docs-v5/en/
- https://developers.binance.com/
- https://www.gate.com/docs/developers/apiv4/en/
- https://bybit-exchange.github.io/docs/v5/intro
- https://www.bitget.com/api-doc/common/intro

浏览器直接访问交易所公开接口；地区网络策略、CORS、限流和维护可能导致部分市场不可用，页面不会用模拟价格代替。升级验证时四家（Hyperliquid、Binance、Gate、Bitget）的 REST 实时报价与历史数据读取成功；OKX、Bybit 在执行环境出现超时，需要线上复核。资金费率按各接口返回的当前周期显示，未提供周期的显示「当期」，不能直接视为同一周期。
