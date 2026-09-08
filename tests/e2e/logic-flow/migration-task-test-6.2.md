# M6.2 逻辑布局与模块显示迁移

基线使用现行 `setupLogicFlow(page, 'clean')`、`db.json`、preview-only 配置、PORT 22762、Chromium、workers=1、retries=0、trace=on。

| 旧编号 | 当前用户动作 | 独立 expected | 当前用例/结果 |
| --- | --- | --- | --- |
| 1.1 | 打开逻辑组网视图 | computed grid 列宽比例为 2:3:3:4 | `ui-adjust.spec.ts:12`，通过；从旧 DOM class 断言迁移为实际计算几何 |
| 1.2 | 将 hullparts 拖入新规划组 | 产线网格列宽比例为 2:3:3:4 | `:25`，通过 |
| 1.3 | 拖拽 hullparts 并观察紧凑视图 | compact view 使用等宽 `grid-cols-4` | `:38`，通过 |
| 2.1 | 打开逻辑组网视图 | candidate ware-grid 左右 padding 为 16/32px，列 gap 为 48px，active draggable-area margin-bottom 为 6px | `:50`，通过 |
| 2.2 | 创建 hullparts 规划组 | planning-zone padding 为 left16/right32/top0/bottom32px，production-group padding 为 0 | `:69`，通过 |
| 3.1 | 查看非 T0 卡片 | 压缩率为百分比文本并带图标，且位于资源标签右侧 | `:83`，通过 |
| 3.2 | 查看 refinedmetals 与 advancedelectronics | 前者为 <=100% 绿色，后者为 >100% 红色 | `:98`，通过；使用固定 ware ID 与静态颜色 expected |
| 3.3 | 查看 T0 卡片 | 不显示压缩率 | `:105`，通过 |
| 4.1 | hover 非 T0 卡片 | 直接轮询最终背景 delta 为 32px（容差），存在 transition，+ 按钮位于扩展区域 | `:115`，产品修复后通过 |
| 4.2 | hover 非 T0 卡片 | 产品名、压缩率与同列真实相邻 sibling 的 bbox 均保持不变，hover 前后 bbox 非空 | `:138`，通过 |
| 4.3 | hover T0 卡片 | 背景不扩展、无 + 按钮、hover 前后颜色相等且非透明 | `:165`，通过 |
| 5.1 | hover 固定 refinedmetals 资源卡片 | 可见 resource-tag 的卡片产品名精确为“精炼金属”；标签 opacity 变为 0，hover 后产品名 `scrollWidth <= clientWidth` | `:188`，产品修复后通过 |
| 5.2 | hover 非 T0 卡片 | 压缩率仍可见且 opacity 精确为 1 | `:208`，通过 |
| 6.1 | 依次拖拽 tier 1/2/3 ware 到新建区 | 预览节点位于首列 | `:220`，通过；使用 antimattercells/hullparts/advancedelectronics 的首列几何断言 |

## 分类

- 测试陈旧：1.1 原断言要求 `.ware-grid` DOM class `grid-cols-[...]`，但样式由 scoped `@apply` 生成，当前 DOM 只有 `ware-grid`。改为读取 computed `gridTemplateColumns`，保留 2:3:3:4 验收。
- 测试拥有：原 5.1 在无资源标签时 `skip`，违反合同；现固定 `refinedmetals`，要求可见 resource-tag、静态中文产品名和 hover 后不裁切，失败被保留。
- 产品候选：4.1 背景 hover 后稳定扩展 28px 而非规范要求的 32px；5.1 当前卡片 hover 后 `.resource-preview-container` 仍为 opacity 1。组件 CSS 仅声明该元素自身 `:hover:opacity-0`，不能满足规范所述卡片 hover 消失。
- 环境：普通沙箱 preview 绑定 localhost 失败（EPERM）；按环境合同使用受控 escalated preview 运行，未修改 runner。

产品修复后 focused 5/5、完整 14/14；build 与相关 Unit 4/4 通过，证据见 `/tmp/x4-test-repair-M6.2/product-fix/`。
