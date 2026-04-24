# active-binding Tasks

## Documentation

- [x] D1. 创建 `active-binding/request.md`
- [x] D2. 创建 `active-binding/design.md`
- [x] D3. 创建 `active-binding/specs/active-binding/spec.md`
- [x] D4. 创建 `active-binding/tasks.md`

## Active 同步

- [x] T1. 收敛 `live-production` 的 active 所有权，明确 `activeViewStore.activeBinding` 为唯一入口
- [x] T2. 调整 `useSaveBindingStore`，使其 `draftBinding / activeBinding` 严格跟随 `activeViewStore.activeBinding`
- [x] T3. 建立统一的 binding 激活事务，覆盖初始化恢复与运行中切换两条路径
- [x] T4. 明确列出“允许改变当前 active binding 的动作”和“只允许修改 binding 数据的动作”，并按该边界收敛现有 API 行为

## Save / Binding 对齐

- [x] T5. 在 binding 激活事务中对齐 `useSaveStore.selectedArchive` 到 `gameGuid + selectedArchiveTime`
- [x] T6. 为 `playerStationRecords` 增加 guid 一致性校验，不满足时清空
- [x] T7. 为 `archiveStation` 增加 guid 一致性门禁，阻断跨 `gameGuid` realtime 数据暴露

## Save 删除失效清理

- [x] T8. 删除当前 active binding 对应 save 后，补齐 active invalidation 传播链
- [x] T9. 当当前 binding 已无有效 archive 时，同步清空 `activeViewStore.activeBinding`、`activeBindingStation` 与 `useSaveBindingStore` 当前 draft
- [x] T10. 当当前 binding 仍有剩余合法 archive 时，自动对齐到剩余 archive 并重建内存计算态
- [x] T11. 为 binding 列表/载入入口增加"是否存档失效"判定
- [x] T12. 在失效 binding 名称后显示红色 `[存档失效]` 标签
- [x] T13. 禁用失效 binding 的载入按钮，并阻断常规载入交互

## 初始化与聚合重建

- [x] T14. 将 `planningDerivedMap` 重建并入 binding 激活事务
- [x] T15. 将 `liveFlowMap` 重建并入 binding 激活事务
- [x] T16. 在 binding 切换后统一执行 `validateActiveStationId()` 与 `mode` 重设
- [x] T17. 确认 `empireGroupedFlows`、overview 聚合、station/transit 聚合在切换后读取到新缓存而非旧残留

## Dirty 规则

- [x] T18. 为 binding 编辑阶段建立 dirty 驱动的延迟重算机制，禁止按“进入 live-production 即重算”实现
- [x] T19. 落实星区编辑 dirty 规则：未影响连接关系且未影响范围内空间站集合时不 dirty；否则整体 dirty
- [x] T20. 落实自由空间站绑定 / 解绑规则：等价视为站点级模块变更，仅目标空间站 dirty

## 验证

- [ ] T21. 补充单元/回归测试：A/B 不同 `gameGuid` 下删除 A 后重新打开 A binding，不得读到 B 的实时数据
- [ ] T22. 补充单元/回归测试：运行中切换 binding 后 overview / station 聚合刷新
- [ ] T23. 补充单元/回归测试：active binding 失效后，`activeViewStore` 与 `useSaveBindingStore` 同步清空
- [ ] T24. 补充单元/回归测试：普通 binding 数据编辑动作不会隐式切换当前 active binding
- [ ] T25. 补充单元/回归测试：失效 binding 显示红色 `[存档失效]` 标签且载入按钮禁用
- [ ] T26. 补充单元/回归测试：星区编辑 dirty 判定符合规则
- [ ] T27. 补充单元/回归测试：自由空间站绑定 / 解绑仅标记目标空间站 dirty
- [x] T28. 运行 `npm run build`
