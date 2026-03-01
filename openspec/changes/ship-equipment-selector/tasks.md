# 任务列表：船只配装装备选择器

## 任务概览

| 任务 | 描述 | 状态 |
|------|------|------|
| T1 | 候选 `0/1/>1` 交互分流 | 已完成 |
| T2 | 展开态三行布局与按钮样式统一 | 已完成 |
| T3 | Race/MK 动态过滤与 Tag 预置+i18n | 已完成 |
| T4 | 展开态允许模式切换与 group/tab 跳转 | 已完成 |
| T5 | slot.type 点击关闭 picker | 已完成 |
| T6 | picker 关闭后 group 冲突回退 connection | 已完成 |
| T7 | 确认赋值与空 group 清理链路验证 | 已完成 |
| T8 | 文档与测试文档 cross-file 同步 | 已完成 |
| T9 | 构建验证 | 已完成 |

---

## [x] T1: 候选 `0/1/>1` 交互分流
- [x] 候选=1 时显示唯一候选名称。
- [x] 候选=1 时点击装备，再点取消装备。
- [x] 候选>1 时点击展开 picker，不在槽位内平铺候选。

## [x] T2: 展开态三行布局与按钮样式统一
- [x] 第一行模式与确认取消，第二行槽位签与分页，第三行兼容/槽位与候选。
- [x] 第一、二行高度固定 `25.6px`。
- [x] 取消/确认按钮与模式按钮统一风格并保留 `mr-1`。

## [x] T3: Race/MK 动态过滤与 Tag 预置+i18n
- [x] Race/MK 来源于当前候选集合。
- [x] Tag 使用预置集合并仅显示候选实际存在项。
- [x] Tag 文本通过 i18n 翻译。
- [x] 三组计数采用“其余两组过滤后”统计。

## [x] T4: 展开态允许模式切换与 group/tab 跳转
- [x] 展开态允许 `connection/group` 切换。
- [x] group/tab 切换保持展开。
- [x] 通过 `connectionKeys` 锚点重映射展开槽位。
- [x] 切换后刷新过滤与候选。

## [x] T5: slot.type 点击关闭 picker
- [x] 展开态点击左侧 slot.type（E/S/W/T/R）关闭 picker。

## [x] T6: picker 关闭后 group 冲突回退 connection
- [x] 关闭 picker 时若 `group` 不可用自动回退 `connection`。
- [x] 关闭态冲突下禁止切换到 `group`。

## [x] T7: 确认赋值与空 group 清理链路验证
- [x] 确认时按 `pickerTarget.connectionKeys` 批量赋值。
- [x] `equipment_id` 与 `shield.equipment_id` 同空的 group 被清理。

## [x] T8: 文档与测试文档 cross-file 同步
- [x] `request/spec/design/tasks` 同步到当前实现。
- [x] `test_tasks/ui_knowledge` 同步到当前实现与数据来源。

## [x] T9: 构建验证
- [x] 执行 `npm run build`。
- [x] 构建通过，无编译错误。
