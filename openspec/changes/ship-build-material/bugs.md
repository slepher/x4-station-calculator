# Bugs: ship-build-material

## BUG-001: method 选项未过滤 xenon

### Status: Verified

### Description
`materialMethodOptions` computed 收集了所有飞船 production 和装备 cost 中的 method，但未过滤掉 `xenon`。

根据需求，method 下拉选项应该过滤掉 xenon。

### Steps to Reproduce
1. 选择大阪飞船
2. 查看 method 下拉选项
3. 预期：xenon 不应出现在选项中
4. 实际：xenon 出现在选项中

### Location
`src/store/useShipBuildStore.ts` line 774-793

### Fix Applied
在 `materialMethodOptions` computed 中添加过滤逻辑，排除 `xenon`。

---

## BUG-002: 选择飞船后 hull 材料为空

### Status: Verified

### Description
当调用 `setSelectedShipId` 设置飞船时，hullGroup 为 null。

根据需求，选择飞船后应能显示船体材料作为独立分项。

### Steps to Reproduce
1. 在测试中调用 `store.setSelectedShipId(OSAKA_ID)`
2. 检查 `store.shipBuildMaterialAnalysis.hullGroup`
3. 预期：应返回船体材料分组
4. 实际：返回 null

### Location
`src/store/useShipBuildStore.ts` line 850-873

### Fix Applied
修改 `hullMaterialGroup` computed，当 blueprint.hull 不存在时，从飞船的 production 数据中派生 hull 材料。

[] 其他槽位上的护盾没有列入统计