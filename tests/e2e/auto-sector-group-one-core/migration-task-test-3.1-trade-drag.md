# M3.1-TRADE-DRAG witness复用

主agent明确允许复用M3.2同一真实行为case，避免重复spec。实现位于 `tests/e2e/auto-sector-group-one-map/auto-sector-group-one-map.spec.ts:294`，原core spec冻结不改。

旧4.6目的完整映射：已有hub virtual trade overlay→真实Mouse拖动→位置改变→anchor/coverage及生产draft不变→保存前binding不变→UI confirm→持久化tradeStation.position/sectorMacro正确且生产payload保持→reload恢复新位置。另验证非hub Mars release拒绝与candidate坐标显示。

证据 `/tmp/x4-migration-M3.2/release-persist.log` 第2项pass（10.5s）；整批2pass exit0。命令PORT22262、preview-only、workers1/retries0/trace，具体行号/独立expected/规范化边界见 `docs/plan/unified-test-repair/direct-migration/results/M3.2.md` witness节。未新增重复spec，未使用原预分配22433端口，也无虚构独立运行。待主agent审核；不关闭GRAPH/DRAFT。
