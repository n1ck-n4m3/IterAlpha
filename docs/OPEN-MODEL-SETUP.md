# Open-model service setup

## 选择与边界

准备了 Qwen/Qwen3.5-4B 的 NF4 4-bit 推理配置，通过 SemIf 的直接 logits 读取产生有限选项判断。这里使用冻结模型，无须训练；没有证据能据此称它为最赚钱或整体最好的免费交易模型。

模型权重 Apache-2.0；SemIf MIT。依赖与模型 revision 均固定。该接口服务可以放在你的 5060 主机，也可以放在独立云 GPU；网站和数据库继续放在当前托管环境。

标准桌面 RTX 5060 是 8 GB 显存；5060 Ti 有不同显存版本。此配置目标是单用户串行请求、最多 1,536 输入 token，避免长上下文和并发撑爆显存。由于设备尚未到位，本次未下载权重、未运行 GPU 测速或确认实际显存占用。安装后必须先验证驱动、CUDA、4-bit 加载与真实请求。

## 安装与启动

在 GPU 主机准备 Python 3.11+、NVIDIA 驱动、Git，按 PyTorch 官方 CUDA 安装说明配置兼容的运行环境，再执行：

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r inference/requirements.txt
export DECISION_API_KEY=your-random-secret-at-least-24-characters
uvicorn inference.server:app --host 127.0.0.1 --port 8000 --workers 1
```

Windows 激活路径使用 `.venv\Scripts\activate`。启动时会下载固定 revision 的模型，需预留额外磁盘、RAM 和网络流量。不要启动多个 worker 重复加载显存。

网站服务器无法访问你电脑的 localhost。需要将服务通过你管理的 HTTPS 网关连接到互联网，网关应保留 Authorization header、限制来源与请求量；不要直接开放没有身份校验的 GPU 接口。若使用组里的主机，需遵循组里的网络和共享设备规则。

## 网站配置

服务端配置：

```text
DECISION_API_URL=https://your-model-service.example/v1/decide
DECISION_API_KEY=the-same-server-only-secret
DECISION_MODEL=Qwen/Qwen3.5-4B
DECISION_MODEL_REVISION=851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a
```

本地预览放进忽略的 `.dev.vars`；线上通过 Sites 的服务器环境变量设置并重新部署。浏览器不接收密钥或推理地址。不需要 OpenAI key 或 Jev key。

当 OpenAI 教练未配置、而此接口配置有效时，训练决策后的教练会额外请求模型检查。若已有 OpenAI 教练配置，仍保留原有路径。

## 请求、输出与验证

- 服务接收两类有限判断：决策理由是否得到已知信息支持、哪个学习主题值得复习。
- 仅发送当时已经可见的事实与计划订单，不发送用户身份、后来价格、最终收益或自由输入的交易论证。
- 固定选项、校验模型来源和 revision、校验数值分布、最大请求 32 KB、单 GPU 串行执行。
- 分数是条件选项分数，未校准；最高分低于 0.6 或前两名差值低于 0.15 时弃权。这是工程阈值，尚未针对你的用户群校准。
- 失败或超时回退到规则教练。模型不能改余额、交易限制或直接下单。
- 当前接口在训练页提供实验性检查；实时蜘蛛仍运行规则策略，并明确显示模型未连接，未伪装成模型正在预测行情。

服务器端契约与失败回退有自动测试；Python 已进行语法检查。模型质量、GPU 运行和 4-bit 分数偏移仍需设备到位后评估。

来源：
- https://huggingface.co/Qwen/Qwen3.5-4B
- https://github.com/TheoLeeCJ/SemIf-OpenJev
- https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/rtx-5060-family/
