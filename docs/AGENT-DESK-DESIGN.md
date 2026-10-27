# IterAlpha Agent Desk 设计

更新日期：2026-10-27。此文档是产品与开发方案；不代表已经接入 Jev、真实行情或真实资金交易。

## 产品定位

把交易代理作为可监督的练习伙伴：代理整理证据、提出方案、演示执行，用户决定目标、风险边界及何时接管。核心仍然是帮助人提升判断能力。代理自身盈利不能证明用户学会了交易。

建议新增入口 **AI Desk**，保留现有 **Train** 的独立决策练习。蜘蛛可以承担状态可视化和品牌角色；真实状态来自后端事件，不用动画伪装正在抓取新闻或成交。

## 三种操作方式

1. **Watch & Learn**：代理在模拟市场演示，关键节点先让用户预测或选择，再揭晓代理方案与证据。适合新手。
2. **Co-pilot**：用户先定资产、资金、策略范围和风险限制；代理提出具体订单，用户保留、缩小、拒绝或接管。模拟盘可以在预先授权范围内自动推进。
3. **Shadow**：用户和代理先独立作答，锁定后比较；双方只能看到相同时间截面的信息，代理答案不充当标准答案。适合进阶练习。

用户可以管理本金、允许的资产、最大总仓位、单次风险上限、当日亏损停止线、持有周期和是否允许自动模拟成交。超出边界必须停止新增风险或回到用户，不得由模型修改限制。

## 市场与执行分开

| 模式 | 数据 | 成交 | 所需权限 |
| --- | --- | --- | --- |
| Synthetic practice | 明确标记的生成场景 | IterAlpha 虚拟账本 | 无交易所密钥 |
| Historical replay | 取得回放及分析权的数据，严格按当时可见信息推进 | IterAlpha 虚拟账本 | 数据授权；无需交易权限 |
| Live paper | 取得公开展示和分析权的真实行情 | IterAlpha 或提供商的纸面成交引擎 | 行情/纸面账户权限；无需真实下单权限 |
| Live execution | 真实行情与真实账户 | 交易所或链上协议 | 用户明确授权的交易密钥或签名 |

连接行情接口并不等于可以下真实订单；连接模型也不等于连接钱包。真实成交应能对上交易所订单号、成交记录及费用，不能以视频动画或本地盈亏数字作为证据。

当前公开 MVP 的 Train 和 Market Lab 都是合成数据。`lib/server/live-market.ts` 保留了未启用的 Coinbase 适配器；现有 AI 教练没有 key 时只返回标明来源的规则反馈。尚未连接 Jev。

## 模块职责

`Market events → Evidence snapshot → Proposal → Decision judge → Hard risk checks → User policy / approval → Execution → Reconciliation → Learning review`

- **Data adapter**：统一生成、历史和真实行情格式，记录来源、事件时间、接收时间、数据缺口与许可范围。模拟行情与真实数据不可静默互换。
- **Evidence engine**：代码计算价格变化、MA、MACD、成交量、波动、价差和成本。新闻保留可核对来源与发布时间。历史回放仅提供截止时刻以前的信息。
- **Proposal agent**：通用语言模型生成候选方案、证据引用、反对证据及失效条件。模型不能读取交易密钥。
- **Decision judge**：可选 Jev 适配器回答有限问题，例如证据是否支持某项描述、是否存在矛盾、是否需要更多信息、下一项教学主题。允许 `insufficient_evidence` 和 `abstain`。
- **Risk engine**：代码计算资金、数量、费率、止损情景损失及敞口，检查限额、报价过期、重复订单和策略版本。Jev 的同意不能绕过硬限制，超时不能默认放行新订单。
- **Execution adapter**：初期只接虚拟账本；真实模式日后单独接入带交易权限的服务。每笔订单使用幂等标识并核对最终成交状态。
- **Coach**：依据已保存的输入、方案、检查和成交事件解释结果。对用户展示可审计的决策摘要，不声称读取了模型内部思维过程。

Jev 不生成讲解文字，所以不能单独担当教练。现有通用模型可先承担提案与解释，再依据实际评测决定是否增加 Jev。Jev 的 `confidence` 来自选项概率分布的集中程度，不应显示为交易获胜概率。

## 界面与一次练习

主界面保留大图表和旁边的信息气泡，右侧用一条 **Decision timeline**：

1. **Observed**：看到了什么，证据与时间戳是什么。
2. **Proposed**：准备买、卖还是等待，候选规模及失效条件是什么。
3. **Checked**：哪些规则通过，哪些存在疑问，是否越过用户限额。
4. **Your call**：用户 **Approve / Resize / Skip / Take over**；不用写长理由。
5. **Executed**：明确显示模拟或真实、计划与实际价格、费用、订单状态。
6. **Learned**：本次过程的一个改进点、市场变化后的再评估，以及三个可能的追问。

“市场变化后再评估”应在新证据、报价过期、波动变化或风险边界变化时触发。先检查风险与原方案的失效条件，再决定是否需要用户处理；不把每根一分钟 K 线都变成强制买卖。

例如用户给定 $10,000 虚拟本金，代理提出 $500 模拟买入。界面说明依据、预计成本、止损情景损失和不确定性；用户选择批准、缩小或跳过。后续价格变化时展示仓位影响及原先条件是否仍成立。所有这些数值都由程序计算，示例参数不构成统一交易建议。

## 实施顺序

1. **先完成可演示闭环**：在现有生成场景上加入三种练习方式、代理事件时间线、策略限制和模拟提案。没有 API 时每个代理响应明确标记为演示。
2. **接入真实行情纸面模式**：先确定数据展示、存储和模型分析用途的许可；增加独立持久账户、报价过期拒单、价差/手续费/滑点、订单状态与断线恢复。
3. **对照评测 Jev**：固定模型版本，比较纯规则、当前语言模型、语言模型加 Jev 的任务准确率、错误放行、弃权率、延迟和调用成本。未经评测不把 Jev 标记为更准。
4. **验证学习效果**：衡量用户在未见过的场景、没有代理提示时是否能更好识别风险和执行自己的规则；区分代理表现与用户能力。
5. **真实资金作为独立后续范围**：单独设计用户交易授权、密钥隔离、账户对账与运行监控，不直接把演示开关改成主网执行。

实时行情观察、逐笔分析和新闻推理不必每个 tick 都调用大模型。按有意义的市场事件触发，缓存同一个信息截面的分析，前端仅实时渲染状态；后台任务与浏览器生命周期分开。

## 一手参考资料

- [TypeSafe Introduction](https://docs.typesafe.ai/introduction)：Jev 的结构化判断和原子问题。
- [TypeSafe Models](https://docs.typesafe.ai/models)：当前模型、版本固定和不能按客户数据微调的限制。
- [TypeSafe Confidence](https://docs.typesafe.ai/confidence)：confidence 的计算含义。
- [HyperGrok Trading Desk](https://github.com/galleonlabs/hypergrok-trading-desk)：研究、风控、用户审批、执行和复盘的分工；不是盈利验证。
- [Coinbase Create Order](https://docs.cdp.coinbase.com/api-reference/advanced-trade-api/rest-api/orders/create-order)：需要授权的真实订单接口。
- [Hyperliquid Exchange endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint)：签名订单接口。
- [Alpaca Paper Trading](https://docs.alpaca.markets/us/docs/paper-trading)：真实行情模拟成交及与真实成交的差异；个人纸面账户不自动授予 SaaS 数据再展示权。
- [Coinbase Market Data Terms](https://www.coinbase.com/legal/market_data)：行情对外展示及派生用途的限制。
