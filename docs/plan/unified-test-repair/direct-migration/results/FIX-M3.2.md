# FIX-M3.2：fix-auto-sector-color-display

状态：T1 implemented / Unit-ready，待主agent审查并协调build/E2E。Resolved change为fix-auto-sector-color-display，BUG-001保持Confirmed，尚未Verified。不自执行build/browser/fullUnit，不改冻结M3.2原13事务。

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

## 待执行

T2由主agent协调build；再独立派发原透明/尺寸严格2项与当前13完整事务。M3.2-UI补充合同独立继续，不能用修复13通过关闭尚未执行细项。无helper/基础fixture/其他src/E2E改动，未删console/debug、未git写；报告不代表用户确认或提交。
