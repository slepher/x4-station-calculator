# dlc-setting 测试知识库

## UI 锚点

### Setting 入口
- Setting 按钮：复用既有 `SettingsButton.vue` 组件
- 红点指示器：setting 按钮上的红点，当 `needsDlcSetup = true` 时显示

### DLC Setting Modal
- Modal 容器：独立的 DLC setting modal 组件
- 关闭按钮：modal 右上角关闭按钮
- 遮罩区域：点击可关闭 modal

### DLC 选择区域
- DLC checkbox 列表：`data-testid="dlc-checkbox-list"`
- 单个 DLC checkbox：`data-testid="dlc-checkbox-{dlcId}"`（如 `dlc-checkbox-plotinus`）
- 全选按钮：`data-testid="dlc-select-all"`
- 全不选按钮：`data-testid="dlc-deselect-all"`

### 未激活 DLC 处理策略
- 策略开关：`data-testid="enforce-dlc-activation-toggle"`
- 策略说明文字：`data-testid="enforce-dlc-activation-description"`

## DLC Fixture 映射

### 基础 DLC (来自 `dlcs.json`)

| DLC ID | 依赖版本 | 说明 |
|--------|----------|------|
| base | - | 基础游戏，不进入候选列表 |
| plotinus | 8.0 | 8.0 版本 DLC |
| additional content | 8.0 | 其他 8.0 DLC |

注：实际 DLC 列表以 `dlcs.json` 为准，测试时应使用当前版本可用的 DLC。

## 版本过滤规则

### dependencyVersion 过滤
- 候选 DLC 必须满足 `dependencyVersion <= currentVersion`
- 例如：`dependencyVersion = 9.0` 的 DLC 在 8.0 版本下不显示

### base 排除
- `base` 永远不进入候选列表

## 存储结构

### localStorage Key
- 基础 key: `x4-setting`
- 8.0-beta key: `x4-setting-8.0-beta`
- 遵循统一的 `getStorageKey('setting', version)` 生成规则

### Setting 数据结构
```typescript
type X4SettingStorage = {
  activeDlcs?: string[]       // 激活的 DLC ID 列表
  enforceDlcActivation?: boolean  // 未激活 DLC 物品处理策略
}
```

### 字段语义
- `activeDlcs` 缺失：表示当前版本尚未显式完成 DLC 设置，红点显示
- `activeDlcs` 存在（含空数组）：表示已完成设置，红点不显示
- `enforceDlcActivation` 缺失：默认视为 `false`

## i18n 键值

### DLC Setting Modal
- `dlc.settings.title` - Modal 标题
- `dlc.settings.select_all` - "全选"
- `dlc.settings.deselect_all` - "全不选"
- `dlc.settings.enforce_activation` - "未激活 DLC 物品处理策略"开关标签
- `dlc.settings.enforce_description` - 策略开关下说明文字
- `dlc.settings.save` - "保存"
- `dlc.settings.cancel` - "取消"

### 策略说明文字内容
说明文字应包含：
- 搜索列表隐藏未激活 DLC 物品
- 已保存项置灰
- 已保存项不参与计算

## 状态模型

### needsDlcSetup
```typescript
needsDlcSetup = !('activeDlcs' in settingStorage)
```
- `true`：当前版本尚未显式完成 DLC 设置，红点显示
- `false`：已完成设置，红点不显示

### activeDlcs（运行时计算）
```typescript
activeDlcs = settingStorage.activeDlcs ?? availableDlcs.map(dlc => dlc.id)
```
- 已保存：返回保存的值
- 未保存：返回全部可用 DLC 作为 fallback

### enforceDlcActivation（运行时计算）
```typescript
enforceDlcActivation = settingStorage.enforceDlcActivation ?? false
```
- 已保存：返回保存的值
- 未保存：默认 `false`

## useGameDataStore 暴露的能力

### 状态读取
- `allDlcs`: 全量 DLC 元数据（来自 `dlcs.json`）
- `availableDlcs`: 当前版本可用 DLC 列表（已过滤）
- `activeDlcs`: 当前版本激活 DLC 列表（运行时计算）
- `enforceDlcActivation`: 未激活 DLC 处理策略状态
- `needsDlcSetup`: 是否缺少 DLC 设置

### Helper 方法
- `isDlcActive(dlcTag: string): boolean` - 判断指定 DLC 是否激活
- `filterActiveDlcItems(items: T[]): T[]` - 过滤出激活 DLC 对应的物品

## 组件层次

```
App.vue (主容器)
├── TopBar.vue (顶部工具栏)
│   └── SettingsButton.vue (Setting 入口，带红点)
└── DlcSettingModal.vue (DLC Setting Modal)
    ├── ModalHeader (标题 + 关闭按钮)
    ├── DlcCheckboxList (DLC checkbox 列表)
    │   ├── SelectAllButton (全选)
    │   ├── DeselectAllButton (全不选)
    │   └── DlcCheckbox[] (单个 DLC checkbox)
    ├── EnforceDlcActivationSection (策略设置)
    │   ├── Toggle (开关)
    │   └── Description (说明文字)
    └── ModalFooter (保存/取消按钮)
```

## 交互流程

### 打开 Modal 流程
1. 用户点击右上角 setting 按钮
2. Modal 打开，读取 `availableDlcs` 和 `activeDlcs`
3. 初始化 checkbox 状态

### 保存流程
1. 用户点击保存按钮
2. 将当前选择写入 localStorage
3. 刷新 store 中的 `activeDlcs` 和 `enforceDlcActivation`
4. 将 `needsDlcSetup` 置为 `false`
5. 关闭 modal

### 关闭流程（不保存）
1. 用户点击关闭按钮或遮罩
2. modal 关闭
3. 不写入 localStorage
4. store 状态不变

## 测试注意事项

### 版本隔离
- 测试时需注意 setting 是按版本隔离存储的
- 切换版本后，setting 状态独立

### 默认值行为
- `activeDlcs` 缺失时的默认 fallback 只在运行时生效
- 默认 fallback 不会自动写回 localStorage

### 红点触发条件
- 红点只与 `activeDlcs` 字段是否存在相关
- 与 `activeDlcs` 的值（包括是否为空数组）无关

## 测试运行

### E2E 测试要点

1. **beforeEach 设置**
   - 必须添加 `test.beforeEach` 清理 localStorage/sessionStorage
   - 等待 `#debug-ready-marker` 确保应用加载完成
   - 禁用 CSS 动画/过渡以加速测试

2. **遮罩点击定位**
   - 点击遮罩时使用 `position: { x: 10, y: 10 }` 避免事件冒泡到 modal 内容
   - 遮罩 testid: `dlc-settings-modal-backdrop`

3. **DLC 版本断言**
   - DLC 版本文本格式为 "Requires X.X"
   - 断言应使用通用格式而非硬编码特定版本号

### 关键 data-testid

| 元素 | data-testid |
|------|-------------|
| Setting 按钮 | `settings-button` |
| 红点指示器 | `settings-indicator` |
| Modal 容器 | `dlc-settings-modal` |
| Modal 遮罩 | `dlc-settings-modal-backdrop` |
| 关闭按钮 | `dlc-settings-close` |
| 全选按钮 | `dlc-settings-select-all` |
| 全不选按钮 | `dlc-settings-clear-all` |
| DLC 列表 | `dlc-settings-list` |
| DLC 项 | `dlc-settings-item-{dlcId}` |
| 策略开关 | `dlc-settings-enforce-toggle` |
| 保存按钮 | `dlc-settings-save` |
| 取消按钮 | `dlc-settings-cancel` |

### 测试运行结果

- 单元测试：9 个测试全部通过
- E2E 测试：30 个测试全部通过
- 无 test_defect 或 product_bug

