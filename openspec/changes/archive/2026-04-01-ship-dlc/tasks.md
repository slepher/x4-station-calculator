# ship-dlc 实施任务

- [x] 1. 舰船与装备 DLC 标签基础接入
- [x] 1.1 为舰船选择列表中的舰船名称右侧增加 DLC 标签展示
- [x] 1.2 为装备 picker 候选列表中的装备名称右侧增加 DLC 标签展示
- [x] 1.3 将标签文本接入游戏 i18n 的 DLC `nameId` 翻译，而不是直接显示原始 `dlc_tag`
- [x] 1.4 为标签实现激活态绿色样式与未激活态红色样式
- [x] 1.5 确保 `base` 舰船与 `base` 装备不显示 DLC 标签

- [x] 2. 舰船候选 DLC 过滤
- [x] 2.1 确认舰船 selector 的统一候选提取入口
- [x] 2.2 将舰船候选提取接入 `useGameDataStore` 的 DLC 激活判断
- [x] 2.3 在 `enforceDlcActivation = false` 时保持现有舰船候选结果不变
- [x] 2.4 在 `enforceDlcActivation = true` 时过滤未激活 DLC 舰船
- [x] 2.5 确保 race/type 计数、分页与待选舰船同步逻辑基于过滤后的结果

- [x] 3. 当前舰船失效收敛
- [x] 3.1 确认 DLC 设置变化时当前舰船有效性的统一校验入口
- [x] 3.2 在 `enforceDlcActivation = true` 且当前舰船失效时自动返回舰船选择界面
- [x] 3.3 保持蓝图数据可保留，不因当前舰船失效而直接清空存储

- [x] 4. 装备候选 DLC 过滤
- [x] 4.1 确认 equipment picker 的统一候选提取与 facet 统计入口
- [x] 4.2 将装备候选提取接入 `useGameDataStore` 的 DLC 激活判断
- [x] 4.3 在 `enforceDlcActivation = false` 时保持现有装备候选结果不变
- [x] 4.4 在 `enforceDlcActivation = true` 时过滤未激活 DLC 装备
- [x] 4.5 确保 race/mk/tag facet 与分页结果基于过滤后的装备集合
- [x] 4.6 将预设蓝图自动选装候选池与手动 picker 列表语义拆分，确保自动选装始终过滤未激活 DLC 装备

- [x] 5. 未激活 DLC 装备禁算
- [x] 5.1 确认舰船属性统计的统一装备聚合入口
- [x] 5.2 在 `enforceDlcActivation = true` 时将未激活 DLC 装备从属性计算输入中过滤
- [x] 5.3 在 `enforceDlcActivation = false` 时保持现有属性计算行为不变
- [x] 5.4 确认装备 diff / comparison 的统一计算入口
- [x] 5.5 在 `enforceDlcActivation = true` 时将未激活 DLC 装备从 diff / comparison 结果中过滤

- [x] 6. 状态来源统一
- [x] 6.1 确保舰船页面统一通过 `useGameDataStore` 读取 `enforceDlcActivation`
- [x] 6.2 确保舰船页面统一通过 `useGameDataStore` 的 helper 判断舰船/装备 DLC 激活状态
- [x] 6.3 避免在页面层直接读取 DLC setting 存储

- [x] 7. 构建验证
- [x] 7.1 完成实现后执行 `npm run build`
- [x] 7.2 若构建失败，修复后重新构建直至通过或记录 blocker
