# resource-pie 实施任务

- [x] 1. 资源过滤表现数据结构升级
- [x] 1.1 在 `MapResourceFilterPanel` 中新增 sector 级染色描述计算，替代只输出单一 `primary color`
- [x] 1.2 保留现有命中 sector 计算与候选排序逻辑，只补充表现层输出
- [x] 1.3 在多资源场景下按 tag 固定顺序筛出参与染色的普通资源，并排除混合场景中的 `日光`

- [x] 2. 饼图切片份额算法
- [x] 2.1 基于 sector 各资源 `level` 计算切片权重
- [x] 2.2 为每个参与资源保留至少 `5%` 的最小显示份额
- [x] 2.3 在 `level` 总和为 `0` 的场景下提供稳定均分与归一化处理
- [x] 2.4 输出单色与饼图两种 fill mode，兼容单资源与仅日光场景

- [x] 3. 地图工作台状态透传
- [x] 3.1 在 `MapWorkbenchView` 中持有资源 sector 染色描述，并下发给 `MapSvgCanvas`
- [x] 3.2 保持关闭资源面板时仅清理资源表现态，不影响面板配置状态
- [x] 3.3 保持搜索高亮与当前选中态输入结构不退化

- [x] 4. SVG 地图饼图渲染
- [x] 4.1 在 `MapSvgCanvas` 中为 sector 新增单色/饼图填充层渲染能力
- [x] 4.2 为多资源场景生成受 sector 六边形约束的扇形 path
- [x] 4.3 在单 sector cluster 与多 sector cluster 分支复用同一套 fill helper
- [x] 4.4 保持 `当前选中 > 搜索命中 > 资源命中` 的样式优先级

- [x] 5. 构建验证
- [x] 5.1 完成实现后执行 `npm run build`
- [x] 5.2 若构建失败，修复后重新构建直至通过或记录 blocker
