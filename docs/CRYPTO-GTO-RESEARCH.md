# Crypto GTO research and execution plan

更新：2026-10-28。当前目标：先验证自用现货策略，再决定是否形成面向客户的产品。首个执行目标是 Coinbase Advanced，其他平台通过独立适配器接入。

## 1. 对“最优决策器”的准确约定

Crypto GTO 是工作名称，目前没有实现或证明市场的 Nash 均衡策略。扑克中的 GTO 建立在明确的游戏规则、收益和对手策略空间上；市场未来分布、交易成本、流动性和参与者会变化。

合理的工程目标是：在限定交易所、币对、持仓时间、成本和风险约束下，估计哪一个允许动作具有较高的净期望效用；证据不足时保留现金。盈利、胜率和最大化期望并不是同一个指标。

目标函数可以写作：

```text
policy(state) = argmax over allowed actions:
  estimated conditional return after execution costs
  - risk penalty
  - estimation uncertainty penalty
subject to exposure, liquidity, loss, and account constraints
```

这只是待估计和检验的目标，不是已知未来的公式。每个估计必须带有数据截止时间、适用区间和样本量。

## 2. 蜘蛛的跳跃到底代表什么

没有看到原视频，不能确定圆柱或跳跃的实际含义。它可能可视化工具调用、访问来源、策略步骤，或只是装饰。

我们产品里的过程动画应由真实事件驱动：

```text
Market event
  -> Closed-bar features and data freshness
  -> Frozen strategy evaluation
  -> Independent risk checks
  -> Order intent or abstention
  -> Exchange acknowledgement
  -> Fill reconciliation
  -> Attribution and evaluation
```

信息采集、决策、下单成功和成交必须分别记录。收到 HTTP 成功不一定已成交；下单超时也不意味着没下单。最终以交易所订单和成交记录核对，遇到未知状态先查单，不盲目重复提交。

当前实时蜘蛛的检查节点已有规则日志，但还没有真实交易所订单确认、真实成交核对或模型推理过程。

## 3. Jev 类机制应该放在哪里

SemIf 是独立开源项目，复现有限选项判断的接口模式，不是官方 Jev 模型。其典型路径是：为固定选项映射标签，读取模型最后位置的选项 logits，再做归一化，省去逐字生成和解析长文本。

```text
score(option_i) = softmax(selected_option_logits / temperature)_i
```

这个分数是给定提示词和候选集合下的相对分数，不能直接解释为未来涨价概率、赚钱概率或 EV。温度、选项措辞、提示词、量化和市场分布都会影响它。须用时间隔离的数据标注与评估，校准也不能证明能赚钱。

建议分层：

| 层 | 职责 | 不应承担的职责 |
| --- | --- | --- |
| 数值特征与规则 | 收益、波动、趋势、价差、深度、成交量、仓位、成本 | 编造缺失行情 |
| 开源语义模型 | 将已发生的新闻分类、识别矛盾、判断信息是否充足 | 把 logits 当作收益预测，批准突破风控 |
| 预测/策略模型 | 在严格样本外测试中估计候选策略的条件收益和不确定性 | 用同一段数据选参又宣称验证成功 |
| 风控与执行代码 | 限额、精度、可用余额、订单状态、熔断与对账 | 将实际成交交给自然语言决定 |
| 解释层 | 根据保存的输入、规则和订单解释发生了什么 | 把事后解释伪装成事前推理 |

Qwen3.5-4B + SemIf 服务与网站调用接口已经准备，但目前没有部署、加载权重或运行 GPU 质量测试。现有调用契约只用于训练反馈的有限检查，尚不能做实时交易的趋势分类。把它用于新任务还需要修改契约、独立评估、故障测试；不能直接复用旧分数。

模型上线先使用 shadow 模式：记录建议，执行策略保持不变。比较有无模型两组的样本外净收益、回撤、成本、延迟和弃权行为，确认增量后再决定是否让它影响策略选择。模型失败、输出不合法或分数不明确时弃权，不能扩大权限或交易限制。

## 4. 已落地的研究基础

- `lib/exchanges/`：交易所实施状态、统一现货接口与明确的交易所身份；金额在未来真实接口中使用十进制字符串。
- `lib/research/schema.ts`：输入检查，拒绝不连续、未收盘、OHLC 不合法和未声明研究使用权的数据。
- `lib/research/backtest.ts`：现有三套规则的历史执行近似。信号最多读取之前 160 根已收盘 K 线，下一根开盘估算成交；与当前实时规则共享 `evaluateStrategy`。
- `lib/research/walk-forward.ts`：每一轮只根据之前的选择窗口比较三套固定策略，然后冻结策略运行下一段测试窗口。无合格候选则选现金。记录所有候选，不只保存赢家。
- `scripts/research-run.ts`：保存数据、配置和引擎源码 hash、全部窗口结果、交易、成本、基线及本地实验登记。

这是一套有限策略的滚动筛选器，没有训练模型、自动寻找所有策略、声称有优势或让回测赢家自动接管线上蜘蛛。固定规则无须训练窗口；未来若训练模型，必须在每折中增加独立训练、校准和验证窗口，并按照标签前瞻期进行 purge/embargo。

历史撮合是 OHLC 近似，与实时盘口纸面撮合有不同的执行模型。不能把两者收益当成同一种精度的证据。进入真实执行前需要同一执行事件日志和历史逐笔/盘口回放验证。

## 5. 如何运行本地研究

使用 Node.js 22.13+，安装项目依赖后运行：

```sh
npm run research -- .research/input.json config/research.example.json
```

数据与输出默认放在忽略的 `.research/`，不会进入公开仓库或网站数据库。命令不会联网，不会读取交易所密钥，也不会下单。不要把账户导出、收费数据或实验结果放进公开目录。

输入 JSON 格式：

```json
{
  "version": "iteralpha-research-data-v1",
  "venue": "coinbase",
  "symbol": "BTC-USD",
  "base": "BTC",
  "quote": "USD",
  "interval": 300,
  "source": {
    "url": "https://your-permitted-data-source.example/history",
    "retrievedAt": "2026-10-28T00:00:00.000Z",
    "usage": "personal-research",
    "rightsConfirmed": true,
    "kind": "exchange-history"
  },
  "rules": {
    "quantityStep": 0.00000001,
    "minQuantity": 0.00000001,
    "maxQuantity": 100,
    "minNotional": 1,
    "provenance": "Illustrative rules only; replace with permitted, period-appropriate instrument metadata."
  },
  "candles": [
    {"time": 1735689600, "open": 100, "high": 102, "low": 99, "close": 101, "volume": 1000}
  ]
}
```

上例只解释结构，不能直接作为回测输入。`time` 为 UTC 秒，`volume` 为基础资产数量；实际至少需要 `160 + selectionBars + testBars` 根连续 K 线，最多 100,000 根；支持 1、5、15 分钟。不得把 USDT 当 USD，也不得把 Binance 的成交质量当作 Coinbase 的成交质量。

`config/research.example.json` 中的费率、价差和交易规则都是示意假设，不是 Coinbase 或任何交易所的实际报价。必须按自己的账户费率、订单类型和目标时期替换，再做成本上浮测试。1 bp = 0.01%。例如单边 60 bp 的手续费，买卖两边约 120 bp，尚未计算价差和滑点，足以改变短线策略结论。

每次输出包括：

- 所有选择窗口和测试窗口、全部候选表现、实际使用策略和风控覆盖。
- 净收益、手续费、已平仓交易数、观察到的平均每笔净盈亏、已平仓胜率与回撤。
- 现金及每折相同初始仓位比例的买入持有对照。这个对照不是波动率匹配，也不是全时段持续持有。
- 数据、配置、信号和研究源码 hash；相同输入不会覆盖旧报告，尝试会追加到实验登记。

报告会标注 `research-only`、`modelUsed: false`、`liveFundsEnabled: false`。合成数据只用于测试程序，不可作为盈利证据。实验登记是本地普通文件，可被修改，不是第三方审计证明。看过测试结果后再改配置，原来的测试就不再是未触碰数据。

历史撮合的已知限制：没有真实历史盘口、排队和部分成交；用上一根成交量作为入场容量近似，退出仍假设可成交；同一根同时触发止盈止损按不利方向处理；缺口按更差开盘估算；每个窗口强制平仓且计费。止损/止盈的时间记录为包含它的 K 线结束时间，不是逐笔事件时间。回撤只观察开盘、收盘和执行点，没有完整的盘中峰值。滚动测试保留全局权益峰值，触发回撤后后续窗口保持现金，不能因换策略重置风控。

## 6. 数据来源不能只看是否免费

Coinbase Advanced 的静态沙盒只适合接口契约测试，不适合验证收益；Coinbase Exchange 与 Advanced Trade 是不同接口，网站目前的 Exchange 行情适配器也不等于用户的 Advanced 账户已经连接。显示、保存、模型使用和自营交易的数据权限要按实际服务与账户协议核实。

Binance Vision 有带校验和的历史档案，2025-01 起现货档案时间戳为微秒，导入前必须正确归一化。其 2026-08-26 数据集条款明确限制为非商业使用，允许纯个人非生产历史研究，但排除生产自营交易执行与商业订单生成。因此本轮没有下载、混入 MIT 软件或用它训练生产蜘蛛；生产需选择具有对应许可的数据。代码的 MIT 不会替外部行情数据授予许可。

## 7. 多交易所接入顺序

| 平台 | 本轮实际状态 | 后续验收重点 |
| --- | --- | --- |
| Coinbase Advanced | 第一执行目标，真实下单未接 | 账户权限、JWT、产品/费率、预览、client order ID、私有成交、余额对账；沙盒为固定响应 |
| Binance | 公共行情与纸面撮合已实现，真实下单未接 | 账户与地区可用性、交易过滤器、服务端行情、用户数据流、签名与限频 |
| OKX | 规划 | cash/spot 模式、地区域名、passphrase、模拟盘与生产凭证隔离 |
| Robinhood Crypto | 规划 | 美国账户资格、官方 API 版本、权限和费率、订单状态及持仓核对 |
| Binance.US | 独立规划 | 独立交易所身份和凭证，不重用 Binance 身份 |
| Kraken / Bybit | 扩展清单 | 逐个验证现货支持、权限、精度和订单生命周期 |

“支持主流平台”指可增加适配器的架构，不能解释为所有平台、地区、账户和币种现在都可交易。当前只有已实施的 Binance/Coinbase 行情类型能进入运行时路由，其余平台不会意外落入 Coinbase 请求分支。没有任何真实 broker 被注册。

## 8. 从自用研究走到真实执行

1. 固定实验协议：先选 BTC/USD、ETH/USD 等小范围现货；定义频率、成本、仓位、亏损限制和指标。不要一开始追求全币种自动搜索。
2. 获取有对应使用权的目标市场数据，覆盖上涨、下跌、横盘和低流动性阶段；固定训练/校准/验证/未触碰测试区间，记录所有尝试和数据版本。
3. 做滚动样本外、成本上浮、参数扰动和不同市场状态测试；比较现金、买入持有和简单规则。至少报告净收益、回撤、交易数、换手与成本、稳定性和不确定性，不能只看胜率。
4. 冻结候选，接 Coinbase 的真实行情做持续纸面交易。使用服务端常驻执行进程、持久订单日志和监控；浏览器展示不承担 24 小时执行。当前浏览器行情结果没有独立验证，不能作为审计证据。
5. 部署可选模型，只旁观记录；验证增量价值。策略调整先在 shadow challenger 中运行，达到预先定义的样本与风险要求再人工晋升。
6. 完成幂等订单、超时查单、部分成交、重启恢复、断网、重复消息、余额和成交核对测试。模型、网页或策略不能修改硬限制。
7. 真金白银阶段另行明确授权：具体账户/币对、总本金、单笔/总仓位、日亏损、回撤、停机后的持仓处理和 kill switch。先小额有界运行；观察盈利不自动授权扩大本金。

这些验收标准应预先确定，达标也不能保证之后赚钱。短期自用盈利也不能证明对所有用户或所有市场可复制。

## 9. 你可以如何指挥开发

可以直接发这段作为下一阶段任务；其中实盘资金的授权仍然需要另行明确：

> 继续开发 IterAlpha Crypto GTO，先实现 Coinbase Advanced 现货的服务端实时行情与持续纸面执行。复用现有策略、风控和实验记录；先核实账户及数据接口适用范围。新增经验证的订单适配层，保留 Binance、OKX、Robinhood 独立扩展。以扣费后的样本外表现为依据，策略先冻结运行，禁止因短期输赢无限制自我修改。Qwen + SemIf 先作为 shadow 判断器，记录截止信息、模型版本、分数、延迟和后续结果，不直接下单。将采集、判断、风控、订单确认、成交、对账映射成真实日志驱动的动态界面。输出可复现实验与部署步骤，清楚标注未接通和未验证部分；没有我的具体资金及交易限制授权，不发送真实订单。

## References

- [Coinbase Advanced sandbox](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/sandbox)
- [Robinhood Crypto API](https://robinhood.com/us/en/support/articles/crypto-api/)
- [OKX API](https://www.okx.com/docs-v5/en/)
- [Binance public data archive](https://github.com/binance/binance-public-data)
- [Binance Vision dataset terms](https://github.com/binance/binance-public-data/blob/master/TERMS_AND_CONDITIONS.md)
- [SemIf source and limitations](https://github.com/TheoLeeCJ/SemIf-OpenJev)
- [The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf)
- [Freqtrade backtesting assumptions](https://docs.freqtrade.io/en/stable/backtesting/)
- [MIT: Learning in extensive-form games](https://www.mit.edu/~6.7980/learning_efg.html)
