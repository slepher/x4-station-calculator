# station-dlc-tag 实施任务

- [x] 1. 空间站模块 DLC 标签基础接入
- [x] 1.1 为空间站已添加模块列表中的模块名称右侧增加 DLC 标签展示
- [x] 1.2 为空间站模块搜索结果中的候选模块名称右侧增加 DLC 标签展示
- [x] 1.3 将标签文本接入游戏 i18n 的 DLC `nameId` 翻译，而不是直接显示原始 `dlc_tag`
- [x] 1.4 为标签实现激活态绿色样式与未激活态红色样式
- [x] 1.5 确保 `base` 模块不显示 DLC 标签

- [x] 2. 搜索结果 DLC 过滤
- [x] 2.1 将空间站模块搜索结果接入 `useGameDataStore` 的 DLC 激活判断
- [x] 2.2 在 `enforceDlcActivation = false` 时保持现有候选结果不变
- [x] 2.3 在 `enforceDlcActivation = true` 时过滤未激活 DLC 模块
- [x] 2.4 在 DLC 过滤后剔除空搜索分组，避免残留空 header

- [x] 3. 已添加模块禁用态
- [x] 3.1 为已添加但未激活 DLC 的模块项增加置暗样式
- [x] 3.2 在 `enforceDlcActivation = true` 时禁用未激活模块的数量修改控件
- [x] 3.3 保持未激活模块的删除操作可用
- [x] 3.4 将“标签状态”和“因策略开启而禁用”的派生状态拆分，避免关闭策略时误禁用

- [x] 4. 空间站计算过滤
- [x] 4.1 确认空间站计算链路的统一模块输入入口
- [x] 4.2 在 `enforceDlcActivation = true` 时将未激活 DLC 模块从计算输入中过滤
- [x] 4.3 确保过滤结果同步影响产出、消耗、建造成本、工人、仓储/体积与 ware flow 等分析输出
- [x] 4.4 在 `enforceDlcActivation = false` 时保持现有计算行为不变
- [x] 4.5 当 `activeDlcs` 或 `enforceDlcActivation` 变化时，触发自动工业区与分析结果重算

- [x] 5. 状态来源统一
- [x] 5.1 确保空间站页面统一通过 `useGameDataStore` 读取 `enforceDlcActivation`
- [x] 5.2 确保空间站页面统一通过 `useGameDataStore` 的 helper 判断模块 DLC 激活状态
- [x] 5.3 避免在页面层直接读取 DLC setting 存储

- [x] 6. 构建验证
- [x] 6.1 完成实现后执行 `npm run build`
- [x] 6.2 若构建失败，修复后重新构建直至通过或记录 blocker
