# IterAlpha agent platform: product and deployment plan

Research date: November 2, 2026. Owner-facing analysis; product and source copy remain English.

## 本质与取舍

产品的主任务改为：**用户选高层策略 → Agent 自动处理纸面订单 → 用户看懂动作与扣费后盈亏**。Simple 与 Pro 是同一账户的两个观察窗口，不是两个产品。原有手动 Play 已归档：主导航与首页不再推广，默认 `/app` 不初始化或创建练习回合；已有记录保留在 More → Practice archive。短场景选择与规则反馈不等于有效训练，也没有经过学习效果验证。

暂时不做从零训练，不把模型名称、漂亮动画或一次盈利当作交易优势。没有可以公开证明对任意 crypto 市场始终最优的“GTO 决策器”。有价值的是可检验的策略、可复现的执行，以及市场变动下仍能解释清楚的结果。

## GitHub 项目筛选

“最适合”按当前预算、纸面现货、可部署性与可审计性判断，不按未经验证的收益截图排名。以下是有针对性的项目清单，并非穷尽 GitHub。许可证以实际采用时的对应提交为准；本轮只借鉴架构，没有复制这些交易项目的实现。

| Project | What to borrow | Limits / fit | Primary source |
| --- | --- | --- | --- |
| Freqtrade / FreqAI | Dry-run, historical testing, cost accounting, strategy lifecycle, adaptive ML | 最适合作为策略研究与验证基线。运行常驻进程；并非 Coinbase / Robinhood 即插即用。GPL-3.0，不直接并入本项目 MIT 源码 | [Repository](https://github.com/freqtrade/freqtrade), [FreqAI docs](https://www.freqtrade.io/en/stable/freqai/) |
| Hummingbot / Condor | Strategy → executor → exchange connector; optional assistant; visible control plane | 更适合做市、执行及常驻控制服务。Condor 使用 Hummingbot API，涉及 Docker 与后台服务，不是把前端部署出去就能常驻交易 | [Condor](https://github.com/hummingbot/condor), [Hummingbot](https://github.com/hummingbot/hummingbot) |
| NOFX | Separate approval-oriented and autonomous operation; decision history and account visualization | 可借鉴产品分层，不把其营销表现当收益证据。AGPL-3.0，避免将其源码复制到 MIT 项目 | [Repository](https://github.com/NoFxAiOS/nofx), [License](https://github.com/NoFxAiOS/nofx/blob/main/LICENSE) |
| HKUDS / AI-Trader | Agent integration, API/skills, background orchestration | 当前仓库 README 已演进为 AI4Trade 集成平台。可参考接口与工作流，不能直接等同于已验证盈利的轻量现货引擎 | [Repository](https://github.com/HKUDS/AI-Trader) |
| SemIf / OpenJev | Frozen model logits → finite typed judgments; model revision and prompt hashes | 推荐的 Jev 类可部署判断机制。不是 Jev 权重、不是预测模型；输出分数需要校准。支持不同本地推理后端 | [Repository](https://github.com/TheoLeeCJ/SemIf-OpenJev) |
| jarrodwatts / jev-trader | Separate intention, order placement, and actual fills; streaming events | Monad / Kuru 场景。README 默认策略包含 mock momentum stand-in，不应误认全部交易由真实 Jev 执行。不是 Coinbase 现货收益证明 | [Repository](https://github.com/jarrodwatts/jev-trader) |
| buberlo / jev-trader | Deterministic state → bounded questions → policy → hard veto → execution → calibration logs | 很适合借鉴判断层与风控分离，但示例和日志不能证明持续盈利 | [Repository](https://github.com/buberlo/jev-trader) |
| TradingAgents | Multiple analyst roles, debate and risk discussion | 适合作为低频研究层参考。多个 LLM 的串行讨论不适合放入当前每 5 秒的低成本执行关键路径；这是架构上的判断，并非延迟实测结论 | [Repository](https://github.com/TauricResearch/TradingAgents) |

**推荐组合：**保留 IterAlpha 的纸面执行与账户账本，参考 Freqtrade 的验证流程；未来用 SemIf 式冻结小模型做可弃权、可审计的辅助判断。需要独立成熟执行基础设施时，再评估 Freqtrade 或 Hummingbot 作为外部服务，而不是直接混入它们的源代码。

## 两个界面的具体设计

### Simple

- 新用户默认 BTC，点击行情节点打开完整币对选择器，可切 ETH / SOL 等当前可用市场。
- 三种指令：Be selective、Follow trends、Catch short moves。每种都对应确定的参数，不允许前端写着低敞口、后台却用另一套参数。
- 用户只填虚拟本金；开始后主要看账户总值、净盈亏、现金、持仓价值、费用。
- 中心是一个机械蜘蛛动态场景；实时行情曲线作为场景中的地形线，币价节点、资金球、决策气泡与风险节点错位分布。点击展开完整市场图或账户曲线；账户线只连接真实保存的检查点，长时间缺口用虚线，不伪造期间表现。
- 底部悬浮操作台选择策略与本金；策略以扇形卡片弹出，场景节点有独立轮廓与缓动交互，避免规则矩形矩阵。Agent 图示为 Market → Agent → Wallet。动画播放已保存的检查；报价接收、判断、成交分别标识。等待不是失败，也不能显示为成交。
- 一句解释当前为什么等、买或卖。详证据与原始账本按需打开。
- 有仓位时主要控制为 Close position & stop；暂停后的仓位仍暴露在市场中，页面明确提示。退出依然需要新鲜报价与足够深度，不伪装已平仓。

### Pro

保留多种图形、MA / MACD / RSI 等指标、盘口、风控参数、费用、滑点、采样与评估节奏、检查回放与导出。两种视图切换保留账户、资金、策略、记录。专业用户不需要重建一个账户才能查看细节。

### 动态与声音

背景是低帧率装饰性渲染，不能替代金融数据。行情更新用平滑数值与图线；成交必须对应实际纸面成交记录。遵循系统减少动态设置，提供手动关闭。声音只强化成交、暂停等事件，取消每次 hold 的重复提示；背景音乐仍需用户主动开启，保留浏览器手势解锁与音量控制。

## 决策系统为什么不必先训练大模型

1. 数据适配器产生有时间戳的市场快照。
2. 代码计算指标、费用、深度、仓位与风险，不能交给模型心算。
3. 规则策略产生 buy / sell / hold 候选。
4. 独立硬风控决定是否允许纸面执行；有任何模型也不能放松这些限制。
5. 可选模型对“证据是否支持规则提议”“证据质量如何”做有限选项判断，可弃权。
6. 账本记录最终成交而非模型意图，绩效按费用和实际持仓计算。

当前执行仍然是规则引擎。模型 API 适配器先处于 **shadow-only**，不会改变订单。类别分数不是上涨概率，不是预期收益，不是已校准置信度。需要持续记录并与无模型策略对照后，才讨论是否给予有限的策略过滤作用。

## 已准备的接口

- `GET /api/spider/capabilities`：公开能力状态，不返回密钥、提供商地址或内部配置。显示规则执行、模型未连接、训练 worker 未配置、真实订单关闭。
- `lib/server/spider-decision-provider.ts`：私有 worker / 离线评估可调用 `shadowTradingJudgment`。限定 HTTPS 或本机 HTTP、拒绝跳转、8 秒截止、16 KB 响应上限、模型与版本校验，失败返回 unavailable。此函数不接入执行路径，也没有面向访客的任意推理代理。
- 请求协议 `iteralpha-trading-judge-v1`：两类有限问题，只传保存时的状态标签，不传未来走势或后续盈亏。
- `inference/server.py` 的 `POST /v1/trading/assess`：可选 GPU 服务；使用现有鉴权、限大小与模型锁。当前没有 GPU、没有加载权重、没有实测延迟。
- 训练协议 `iteralpha-training-job-v1` 与 `TrainingAdapter`：定义 submit / status / cancel 的未来 worker 边界。当前只验证任务格式，**不提交、不排队、不训练**。校验脚本：`node --experimental-strip-types scripts/validate-training-job.mjs docs/TRAINING-JOB-EXAMPLE.json`。
- 训练任务必须包含来源、数据使用权限确认、实际 checksum、按时间分开的训练 / 验证 / 测试、覆盖标签期限的隔离区、费用与基线。示例文件的零 checksum 是占位，不能用作正式任务。

未来 worker 的调用示意（不是当前正在运行的后台）：

```ts
const assessment = await shadowTradingJudgment(savedBotView, savedCycle, environment);
// Store this shadow record separately. Never turn it directly into an order.
```

服务器环境配置名：`SPIDER_DECISION_MODE=shadow`、`SPIDER_DECISION_URL`（完整 `/v1/trading/assess` 地址）、`SPIDER_DECISION_KEY`、`SPIDER_DECISION_MODEL`、`SPIDER_DECISION_REVISION`。密钥只能放服务器环境，不放浏览器或 GitHub；启动 GPU 服务使用同一鉴权值配置其 `DECISION_API_KEY`。仅配置这些变量不会自动启动推理、训练或后台交易，仍需独立 worker 负责调用与保存结果。

## 5060 与部署

[NVIDIA 规格](https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5060-family/)中桌面 RTX 5060 为 8 GB 显存，5060 Ti 有不同规格。拿到机器后以实际型号和显存为准。

- **现在：**网站仍在托管平台运行，数据库仍为该 Site 绑定的 D1；不是你的独立主机。浏览器实时纸面执行在隐藏或关闭页面时暂停，不是 24/7。
- **不需要 GPU 的部分：**行情采集、指标、风险、账本和常驻调度。低成本 CPU 服务即可，但网络与交易所允许使用的范围需实际验证。
- **未来 5060：**优先尝试固定版本 [Qwen3.5-4B](https://huggingface.co/Qwen/Qwen3.5-4B) 的 4-bit 读取服务；保留已有安装说明。上下文、KV cache、框架与并发会占显存，4-bit 权重大小不等于整套服务显存。先测峰值显存和 p95 延迟，放不下再评估更小模型并更新版本校验与测试。
- 冻结模型推理可先做；8 GB 上的 LoRA 是否可行取决于上下文、优化器等，不能预先承诺。先做 CPU 级校准或轻量监督基线，通常比从零训练 LLM 更符合你的目标。
- GPU 主机可在实验室，网站仍在云端；通过受保护 HTTPS 或私有隧道连接。主机休眠、断网时模型应不可用，不能静默替换为“AI 成功”。
- 未来常驻实时交易 worker 与前端分离；模型不是每 5 秒必须调用的依赖。现阶段不配置任何真实资金接口。

## 先证明什么，再进入下一阶段

1. 跑通不同币与成本假设的纸面交易；确保扣费净值与账本对得上。
2. 与现金、买入持有、相同规则无模型版本比较。报告交易次数、净收益、最大回撤、费用、持仓时长，不只看胜率。
3. 用明确数据来源的历史 walk-forward 和之后的前向纸面记录；不能随机拆开高度相关的行情或泄露未来新闻。
4. 模型先做影子评估：校准、弃权率、增量收益、额外费用、延迟与失效情况。没有增量就不用模型。
5. 在有足够证据和明确授权之前，不启用真实资金、杠杆或自动策略改写。

## 场景界面的视觉参考

参考 [Rotli](https://rotli.co/) 的清晰叙事、[Devolfs](https://www.devolfs.com/) 的产品表达、[Linear](https://linear.app/) 的细节层次以及 [Reflect](https://reflect.app/) 的渐进展开。借鉴的是留白、内容层次、按需展开的交互原则，不复制它们的资产或源代码。场景由 React、SVG、CSS 动画与已有 WebGL 氛围层构成；更换的是前端组合与布局骨架，后端账本和风险规则保持一致。

## Why Play is archived

现阶段的 Play 缺少明确训练目标、真实决策环境的迁移验证、稳定对照基线，以及反复练习后的能力测量。它能够演示下单与复盘交互，但不足以承担产品的核心训练承诺。因此保留数据与兼容路由，移除主入口，并停止 Agent 页面加载与其无关的练习数据和教练请求。

后续只在有实质训练内容时重做：使用真实 Agent 决策快照，展示用户选择的高层策略如何影响仓位与成本；在相同历史区间与相同费用条件下比较策略；用未见数据和明确指标检验改进。单次路径中的事后更优选择不称为 EV 或能力提升。

## Current market-data scope

Agent 目前使用 Binance 所选现货币对的 K 线、ticker 和可见盘口快照，通常每 5 秒轮询；不是 WebSocket 连续逐笔行情，也不是全部交易所汇总。每次读取最多 100 档盘口，Tape 策略和 Pro 的盘口占比统一使用每侧前 10 档的报价币金额（价格 × 数量）。这不是独立买家/卖家人数、已经成交的资金流，或保证能够成交的流动性；挂单可能在实际执行前改变或取消。公开接口没有独立交易者身份，因此不能由这些数据推导实时参与人数。

参考 [Binance order-book and trade API definitions](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market)。逐笔/聚合成交流、新闻、链上活动和资金费率尚未接入。策略信号与指标是代码基于行情计算的解释；Agent 订单、费用、滑点和盈亏来自纸面执行假设。浏览器提供的快照标记为 unverified，接收时刻不等于交易所事件时刻。原 Play 的价格仍是合成场景，与实时 Agent 分开。
