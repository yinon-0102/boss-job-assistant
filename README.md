# BOSS 实习投递助手

在已登录的 BOSS 直聘账号中，按求职条件筛选实习，并根据岗位 JD 和站内简历撰写个性化招呼语。离线预览使用模拟数据，只需本地 Node.js（在 v24 上验证）。

项目与 BOSS 直聘无隶属关系。

## 是否需要安装 Computer Use MCP

| 使用方式 | 本机需要什么 |
| --- | --- |
| 在终端运行 `node preview.mjs --demo` | Node.js 即可，无需 Computer Use MCP。 |
| 操作 BOSS 网页或浏览器里的本地模拟页 | Codex 需要接入 Windows Computer Use MCP。当前会话已能调用 `computer_use` 的 `start_task`、`screenshot` 和 `batch` 时，可以直接使用。 |

克隆本仓库会下载 skill 和配套脚本。新电脑或尚未接入 Computer Use MCP 的 Codex 环境，需要另外安装 MCP 服务并将它接入 Codex。`desktop.mjs` 负责生成调用参数，实际截图和点击由 MCP 执行。接入后，在新的 Codex 会话中核对上述工具是否可用。[Computer Use MCP 安装说明](https://github.com/cenglin123/computer-use-mcp/blob/master/INSTALL.md) · [Codex MCP 配置](https://developers.openai.com/codex/mcp)

## 在 BOSS 直聘使用

在浏览器登录 BOSS 直聘，在 Codex 中调用 `$boss-job-assistant`，提供意向城市、岗位方向、薪资区间及计薪单位、出勤和实习时长，并说明要预览、填写还是发送招呼语。

Skill 先在账号内查看个人资料、求职期望和三份简历正文，再筛选岗位。招呼语开头集中写已核实的毕业届别、实习时长和获奖经历，后半段按 JD 调整所选站内简历中的项目描述。整段直接填入 BOSS 聊天框，输入完成后统一检查，并按用户授权发送招呼语。Skill 提供简历版本建议，真实简历由用户自行发送。详细步骤见 [SKILL.md](SKILL.md)。

### 如何授权发送招呼语

例如可以说：「请选一个符合条件的岗位，给招聘方发一条个性化招呼语。可以引用我的 BOSS 站内简历中的奖项和项目经历，并写明我已确认的实习时长和出勤。」

### 连续沟通多个岗位

> 请联系 20 个符合条件的深圳 Agent 开发实习岗位，日薪至少 100 元，每周可出勤 5 天、实习 3–6 个月。可以在招呼语里写我的届别、实习安排，并引用 BOSS 站内简历中的奖项和相关项目经历。

Skill 按本次条件逐个选岗、写招呼语、发送并核对聊天记录，无需在 Codex 逐条确认。确认送达后再计数，到目标数量即停止。若符合条件的岗位不足，或平台限制影响继续发送，会报告已送达数量和原因。自动审批拦截时会保留相应草稿，汇报受阻岗位。用户也可以核对后在 BOSS 聊天框自行发送。

## 桌面模式试跑

在支持技能的宿主中加载本仓库的 [SKILL.md](SKILL.md)，并确认其 Windows Computer Use MCP 提供任务、截图、批量操作和键盘输入工具。在浏览器中打开 [模拟岗位](examples/desktop.html)，然后对宿主说：

> 使用 boss-job-assistant 的桌面模式测试当前模拟岗位。目标杭州，Agent 或 AI 应用开发实习，每周 4 天，可连续 4 个月。读取页面，生成并填入招呼语，选择对应版本，提交模拟表单并核对回执。

`desktop.mjs` 输出要调用的工具和参数，宿主通过已连接的 MCP 执行并读取截图。独立运行该脚本会打印 JSON。截图中的字段由宿主模型读取，筛选和文案仍由 `preview.mjs` 生成。模拟页仅在当前标签页生成回执。公开项目经历均为虚构样例。

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

离线草稿基于 `evidence.json` 的虚构项目和固定句式，由脚本生成。`attachmentStatus: unverified` 表示缺少实际附件的核验记录，`contactActionsPerformed` 为 `0`。

## 许可证

[MIT](LICENSE)
