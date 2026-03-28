# dlc-setting / dlc-tag 测试任务

## 测试结果

**单元测试**: 37 个测试全部通过
**E2E 测试**: 20 个通过，1 个跳过（因缺少非 base DLC 模块自动跳过）

## 1 单元测试

### 1.1 DLC Utils - 纯函数测试

**文件**: `tests/unit/dlc-settings/dlc-utils.spec.ts`

**测试结果**: ✅ 22 个测试全部通过

**测试覆盖**:
- `normalizeDlcId` - DLC ID 归一化（移除 ego_ 前缀）
- `isDlcActive` - DLC 激活状态判断
- `filterActiveDlcItems` - 激活 DLC 物品过滤
- `filterAvailableDlcs` - 版本过滤
- `needsDlcSetup` - 是否需要 DLC 设置判断
- `getActiveDlcs` - activeDlcs getter 逻辑
- `enforceDlcActivation` - 限制策略开关

### 1.2 searchModule - DLC 过滤

**文件**: `tests/unit/dlc-settings/search-module-dlc.spec.ts`

**测试结果**: ✅ 15 个测试全部通过

**测试覆盖**:
- `includeModule` 回调过滤
- 搜索结果 DLC 标签可见性
- 分组逻辑与空组剔除
- 模块排序（tier 和字母顺序）
- 边界情况处理

## 2 E2E 测试

### 2.1 DLC Settings Modal - 基础交互

**文件**: `tests/e2e/dlc-settings/dlc-settings.spec.ts`

**测试结果**: ✅ 9 个测试全部通过

**测试覆盖**:
- ✅ 打开 DLC 设置 modal
- ✅ 关闭 modal（关闭按钮、遮罩、取消按钮）
- ✅ DLC 列表显示
- ✅ 全选/全不选功能
- ✅ 单个 DLC 勾选/取消
- ✅ 限制策略开关
- ✅ 保存设置
- ✅ 取消保存（设置不持久化）

### 2.2 DLC Settings - 红点提示

**文件**: `tests/e2e/dlc-settings/dlc-settings.spec.ts`

**测试结果**: ✅ 2 个测试全部通过

**测试覆盖**:
- ✅ 未设置 DLC 时显示红点
- ✅ 已设置 DLC 后红点消失

### 2.3 DLC Settings - i18n

**文件**: `tests/e2e/dlc-settings/dlc-settings.spec.ts`

**测试结果**: ✅ 2 个测试全部通过

**测试覆盖**:
- ✅ DLC 名称使用游戏 i18n 翻译
- ✅ 需要版本显示

### 2.4 DLC Tag 显示 - 搜索候选列表

**文件**: `tests/e2e/dlc-settings/dlc-tag-display.spec.ts`

**测试结果**: ✅ 2 个测试全部通过

**测试覆盖**:
- ✅ 搜索候选模块显示 DLC 标签
- ✅ DLC 标签样式 - 激活状态（绿色边框）

### 2.5 DLC Tag 显示 - 已添加模块列表

**文件**: `tests/e2e/dlc-settings/dlc-tag-display.spec.ts`

**测试结果**: ⚠️ 1 个通过，1 个跳过

**测试覆盖**:
- ✅ 已添加模块显示 DLC 标签
- ⚠️ DLC 标签 - 未激活状态样式（跳过：没有可用的非 base DLC 模块）

### 2.6 enforceDlcActivation - 搜索过滤

**文件**: `tests/e2e/dlc-settings/dlc-tag-display.spec.ts`

**测试结果**: ✅ 2 个测试全部通过

**测试覆盖**:
- ✅ 关闭限制策略时显示全部模块
- ✅ 开启限制策略时隐藏未激活 DLC 模块

### 2.7 DLC 设置变化触发重算

**文件**: `tests/e2e/dlc-settings/dlc-tag-display.spec.ts`

**测试结果**: ✅ 1 个测试通过

**测试覆盖**:
- ✅ DLC 设置保存后触发重算

## 3 测试运行命令

### 3.1 运行单元测试
```bash
npm run test:unit -- tests/unit/dlc-settings/
```

### 3.2 运行 E2E 测试
```bash
npm run test:e2e -- tests/e2e/dlc-settings/
```

### 3.3 运行单个测试文件
```bash
# 单元测试
npm run test:unit -- tests/unit/dlc-settings/dlc-utils.spec.ts
npm run test:unit -- tests/unit/dlc-settings/search-module-dlc.spec.ts

# E2E 测试
npm run test:e2e -- tests/e2e/dlc-settings/dlc-settings.spec.ts
npm run test:e2e -- tests/e2e/dlc-settings/dlc-tag-display.spec.ts
```

### 3.4 UI 模式运行 E2E
```bash
npm run test:e2e:ui
```

## 4 Bug 测试

### 4.1 待测试 Bug 场景

**文件**: `tests/e2e/dlc-settings/bug-dlc-settings.spec.ts` (待创建)

**测试场景**:
1. **版本切换后 DLC 设置隔离**
2. **DLC 元数据更新后候选列表同步**
3. **连续快速切换 DLC 状态**
4. **i18n 语言切换**
5. **空状态处理**
6. **LocalStorage 损坏恢复**

### 4.2 已知 Bug 回归

待补充
