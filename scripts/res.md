# 资源本地化同步 (Resource Localization Sync)

## 目标
将 `res.json` 中的全名数据同步到网站前端系统的本地化文件 (`src/locales/*.json`) 中。
此过程 **不使用脚本**，而是作为 Prompt 指导 AI 模型直接执行更新。

## 输入数据源
- **文件**: `src/assets/x4_game_data/8.0-Diplomacy/data/res.json`
- **格式**:
  ```json
  [
    {
      "id": "energycells",
      "name_en": "Energy Cells",
      "name_zh-CN": "能量电池",
      "name_de": "Energiezellen",
      ... (包含所有游戏支持的语言)
    }
  ]
  ```

## 目标文件
- **目录**: `src/locales/`
- **文件识别**: 扫描该目录下所有现存的 `.json` 文件 (例如 `zh-CN.json`, `en.json`)。
- **语言代码提取**: 从文件名中提取语言代码 (例如 `zh-CN.json` -> `zh-CN`, `en.json` -> `en`)。

## 处理逻辑 (AI 指令)
请遵循以下步骤处理每一个检测到的目标语言文件：

1. **读取目标文件**: 读取 `src/locales/{lang}.json`。
2. **定位命名空间**: 找到或创建名为 `res` 的键 (Namespace)。
3. **数据映射与智能缩写**:
   - 遍历 `res.json` 中的每一项。
   - **Key**: 使用 `id` 字段。
   - **Value**: AI 模型需读取全名，**基于以下优先级策略生成缩写**，无需人工干预：
     
     **通用策略 (Priority Hierarchy)**:
     1. **化学式/元素符号 (最高优先级)**: 
        - 适用于气体、矿物。
        - 示例: Methane/甲烷 -> **CH4**, Helium/氦 -> **He**, Silicon/硅 -> **Si**, Hydrogen/氢 -> **H**。
     2. **社区标准缩写 (Community Standard)**:
        - 适用于极高频使用的核心资源。
        - 示例: Energy Cells -> **EC** (英文通用), **电** (中文通用)。
     3. **语义压缩 (Semantic Compression)**:
        - **中文**: 提取或生成 **1个** 最具辨识度的字 (如 Raw Scrap -> **废**, Nividium -> **N**)。
        - **英文**: 提取 **2-4个字母** 的强音节组合，避免 "Met" (Metal/Methane) 这种歧义。
          - 示例: Nividium -> **Niv**, Raw Scrap -> **Scr**。

     **质量控制检查点**:
     - 🚫 **拒绝机械截取**: 禁止仅取前三个字母 (如 "Met" 对于 Methane 是不可接受的)。
     - 🚫 **拒绝生僻字**: 中文缩写必须是常用字。
     - ✅ **唯一性校验**: 确保生成的缩写在同一语言文件中不重复。
   - **查找逻辑**:
     - 优先查找 `name_{lang}` (例如 `zh-CN` 找 `name_zh-CN`)。
     - 若未找到，可尝试回退 (如 `en` 找 `name_en` 或 `name`)。
4. **更新写入**: 将生成的键值对 (ID -> 智能缩写) 写入目标文件的 `res` 命名空间下，保持 JSON 格式整洁。

## 扩展性说明
- **动态支持**: 本规则不硬编码支持的语言列表。未来若 `src/locales/` 下新增了 `ja.json` (日语)，只需再次执行本规则，AI 应自动识别并从 `res.json` 中提取 `name_ja` 进行填充。


