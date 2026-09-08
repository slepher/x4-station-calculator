# FIX-M3.2：fix-auto-sector-color-display

状态：Verified。Resolved change 为 fix-auto-sector-color-display；当前固定候选已完成 build、全量 Unit、focused 及完整 M3.2 浏览器复验。

透明色首次浏览器复验发现 reload 恢复链仍由 `initAutoGroupDraft()` 无条件稳定化颜色，将 `undefined` 改为 `#194D33`。最终修复在 `enrichAutoGroupResult()` 增加必传 `stabilizeColors`，由 `initAutoGroupDraft()` 仅在 `needsAutoGroupRecalc === true` 时启用：恢复保存状态保留透明，真实计算仍为缺色/冲突色分配颜色。`autoGroup.spec.ts` 直接覆盖两个分支；独立审查通过。

## 最小根因与修改

当前安装vue-color3.3.3真实SketchPicker预设DOM只有title/aria-label，无data-color；透明点击经model update发#00000000，旧onColorUpdate直接转发，父级popper click读不存在data-color无法清空。现在唯一输入为model update，局部useSectorGroupColorPresenter复用vue-color导出的tinycolor，alpha0→undefined；alpha1规范hex；非零alpha保留hex8；非法输入不emit且保持picker。不再固定蓝色fallback，空色打开picker以transparent为model。Vue仅转发事件和关闭弹层，不新增Vue-store逻辑。

调用消费者：SectorGroupList两种draggable/non-draggable布局共同SectorGroupCard；Map/Live AutoSectorGroupPanel共用handleColorChange，后者已直接接受undefined。保存updateGroup/normalizeState与saved→draft恢复均复制color，未发现需扩store路径；确认/reload是否仍保持空色必须由fresh build后的原严格E2E最终确认。

MapSectorGroupColorLayer将单/多sector统一为同一polygon路径，使用实际sector.sx/sy（零坐标有效）和radius*2/3；无色不创建polygon，fill-opacity0.35/顺序/点击sector层未动。统一局部模板避免旧single的sx||cx错把0替换、multi仍生成隐藏空polygon，属于同心/无色要求闭包。

## 当前Unit证据

新增autoSectorColorDisplay.spec.ts共9项：真实Sketch透明/不透明click及唯一末事件；两个hex8 alpha0；非零alpha保留；非法输入不默认；single零坐标+2/3；multi独立中心/半径+无色不画；single无色不画。

|阶段|exit|count|log|
|---|---:|---|---|
|修复前focused|1|6fail/3pass，1.52s|/tmp/x4-migration-FIX-M3.2/red.log|
|修复后同focused|0|9pass，1.37s|/tmp/x4-migration-FIX-M3.2/green.log|
|最终有限消费者|0|4files/17pass，1.85s|/tmp/x4-migration-FIX-M3.2/consumers.log|
|owned git diff --check|0|输出为空|已执行|

命令：`npm run test:unit -- tests/unit/current/auto-sector-group/autoSectorColorDisplay.spec.ts`。消费者额外同命令路径为sectorGroupCardStructureLock.spec.ts、sectorGroupListDragHandle.spec.ts、tests/unit/current/map/mapSvgLayerOrder.spec.ts。非全Unit；Browserslist提示未处理。

## 最终验证

当前 patch 的 `npm run build` exit 0，canonical Unit 175 files / 1000 tests passed；透明/覆盖层 focused 4/4，完整 M3.2 13/13 passed、0 skipped。日志与 trace 位于 `/tmp/x4-test-repair-current2/`。M3.2-UI 补充合同独立继续，不能用当前 13 项关闭尚未执行细项；本报告不代表提交授权。
