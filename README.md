# BOSS 实习投递助手

用手动输入的主页线索、求职条件和模拟 JD，测试“关键词建议 → 岗位筛选 → JD 对应的招呼语 → 简历版本推荐”。只依赖本地 Node.js（在 v24 上验证），无需安装依赖，不联网、不需要服务器，也不需要配置 MCP。

桌面模式使用已接入 Windows Computer Use MCP 的 Skill 宿主。项目与 BOSS 直聘无隶属关系。

## 桌面模式试跑

在支持技能的宿主中加载本仓库的 [SKILL.md](SKILL.md)，并确认其 Windows Computer Use MCP 提供任务、截图、批量操作和键盘输入工具。在浏览器中打开 [模拟岗位](examples/desktop.html)，然后对宿主说：

> 使用 boss-job-assistant 的桌面模式测试当前模拟岗位。目标杭州，Agent 或 AI 应用开发实习，每周 4 天，可连续 4 个月。读取页面，生成并填入招呼语，选择对应版本，提交模拟表单并核对回执。

`desktop.mjs` 输出要调用的工具和参数，宿主通过已连接的 MCP 执行并读取截图。独立运行该脚本会打印 JSON。截图中的字段由宿主模型读取，筛选和文案仍由 `preview.mjs` 生成。模拟页仅在当前标签页生成回执。公开项目经历均为虚构样例，真实招聘站点的发送、附件及回执需要单独实测。

## 在 PowerShell 中运行

```powershell
# 在仓库根目录运行以下命令。

# 跑内置模拟数据
node .\preview.mjs --demo

# 直接读取一份独立的输入文件
node .\preview.mjs --input .\examples\custom.json

# 只在内存里改 JD，通过命令行标准输入传进去，不修改示例文件
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$sample = Get-Content -Raw -Encoding utf8 .\examples\custom.json | ConvertFrom-Json
$sample.jobs[0].jd = '维护多步执行与工具调度，负责上下文预算和跨会话记忆。'
$sample | ConvertTo-Json -Depth 10 | node .\preview.mjs --input -

# 回归测试
node --test .\tests\preview.test.mjs
```

`examples/demo.json` 和 `examples/custom.json` 的城市、公司、到岗条件都是测试数据，不代表你的真实求职意向或可到岗时间。

## 输入

| 字段 | 含义 |
| --- | --- |
| `profile.desiredTitle`、`profile.keywords` | 可选的模拟主页线索；只会把与候选词匹配的词提前，不会扩大城市或方向范围。 |
| `preferences.cities` | 至少一个目标城市，按完整名称匹配；例如输入 `上海` 时不要在岗位里混写成 `上海市`。 |
| `preferences.directions` | 至少一个方向，可填 `agent`、`ai-app`、`fde`；顺序用于搜索方案，岗位结果保留输入顺序。 |
| `preferences.internshipOnly` | `true` 只考虑明确的实习岗位；`false` 不按雇用类型限制。 |
| `preferences.availableDaysPerWeek`、`preferences.availableMonths` | 可选，分别为每周可到岗天数和可持续月数，使用正整数。 |
| `jobs` | 岗位数组；每条至少有 `id`、`company`、`title`，另填 `city`、`employment`、`jd`、`minDaysPerWeek`、`minMonths`。`employment` 可为 `internship`、`full-time`、`part-time`。没有的信息可以留空或用 `null`。 |
| `jobs[].alreadyContacted` | 可选布尔值。只要同一 `id` 的任一记录为 `true`，整批不为该岗位生成招呼语。历史沟通状态需由输入提供，程序不会自行查询。 |

请把 JD 中的到岗天数和时长单独填写为数字。目前不会从 JD 正文自动提取这些条件。只知道单侧的到岗要求或可用时间时，进入人工确认。

## 输出

- `searches`：按城市和方向列出建议搜索词，不执行站内搜索。
- `draft`：命中职责和一条项目证据，附招呼语草稿和简历版本建议。修改 JD 可触发同一方向下的不同证据和文案。
- `review`：关键信息缺失、职责难区分或缺少对应证据；不给草稿和简历版本。
- `skip`：已沟通、批内重复、条件冲突或不在目标方向；给出原因。

草稿基于 `evidence.json` 的虚构项目和固定句式，不调用模型。试用时请不要把示例经历当成自己的经历；实际使用前，应在本地用核实过的项目事实替换示例。请勿将个人简历或本地输入提交到公开仓库。`attachmentStatus: unverified` 表示未指定、读取或核验实际 PDF。命令没有发送或投递选项，`contactActionsPerformed` 为 `0`。

## 许可证

[MIT](LICENSE)
