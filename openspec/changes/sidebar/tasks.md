# 实施任务：产能侧边栏

每个行为任务同时实现并运行其 focused Unit，测试仅放在 `tests/unit/sidebar/**` 或已有对应 `tests/unit/**` 文件。任务完成情况以勾选状态为准；按 P0 → P1 → P2 推进，不建立独立 Unit 实施阶段。

## P0：合同、业务入口与核心交互

- [x] 1. 明确 blueprint/live presenter 合同，将 Vue 内固定入口、树分组、图标、tooltip、菜单权限等展示组装迁至 presenter；两工作区侧栏接线通过 presenter，保持现有功能导航与特殊树。Unit 覆盖平铺／分组两种来源、固定入口能力和 station/transit 模式映射。
- [x] 2. 蓝图保留添加站点，实况不显示底部主动作；菜单复用现有规划删除权限并将绑定调整／解除导向原流程。Unit 验证实况无主入口、不调用 createStation、条目绑定上下文准确、已绑定实体不可被误删。
- [x] 3. 建立侧栏偏好 store 与版本化 normalization，实现模式／上下文隔离、宽度默认值、折叠集合、滚动位置及后续置顶／实况展示顺序字段。Unit 覆盖旧数据缺字段、非法宽度、重复 ID、实体加载前不清理、加载后清理、蓝图／绑定切换和持久化恢复。
- [x] 4. 实现展开／64px 窄栏、独立组折叠、顶部固定按钮／中间统一滚动／蓝图底部固定入口、完整名称提示、活动项和所属组状态。Unit 验证窄栏仍输出导航入口，折叠不改变业务选择，箭头／导航／菜单互不误触；将既有基础可访问性和中英文文案接入。最终滚动边界调整由任务 17 覆盖。
- [x] 5. 实现业务分组名称／九色色板浮层，复用绑定组规范身份和 updateGroup 草稿操作，提供应用／取消、空名错误、自定义色保留、当前颜色选中圈、视窗内定位。Unit 覆盖 sectorMacro 与原始 ID 映射、trim、空名拒绝、取消、字段并发修改拒绝、上下文失效、同字段跨视图同步、保存刷新及放弃恢复。
- [x] 6. 实现普通返回的偏好恢复与明确外部导航 token 的优先定位，替换仅凭 tabs.length 变化展开组的行为。Unit 覆盖手动折叠后无关更新不重开、同站重复外部导航、目标消失、token 仅消费一次、DOM 更新后产生定位指令及模式恢复隔离。

## P1：定位与空间利用

- [x] 7. 实现名称搜索、命中组上下文、无结果提示、搜索前折叠／滚动快照和清除恢复；搜索期间外部导航结束搜索后定位。Unit 覆盖组名命中所有成员、站名命中保留父组、清除恢复、搜索不修改选择、切上下文清理和搜索期间排序禁用。
- [x] 8. 实现桌面 200–400px 宽度拖动、pointer capture、取消／卸载清理和展开宽度恢复。Unit 覆盖上下限、pointerup 一次提交、pointercancel 不提交、收起展开恢复及模式隔离。
- [x] 9. 统一条目行内“⋮”和右键菜单动作，完善禁用／不存在上下文反馈及所有新 tooltip／按钮／错误的中英文文案。Unit 覆盖两个入口动作一致、按钮不导航、失效对象不执行、蓝图和实况权限矩阵。

## P2：排序、常用入口与窄屏

- [x] 10. 实施前读取 x4-drag 及列表配方，核查安装版本；沿用 model-value + update 提议 + 合法释放一次提交的路径，保留蓝图领域排序，增加实况组内／分组展示排序。使用独立 handle、库占位和同组限制，取消／外部释放恢复。Unit 覆盖完整排列、重复／缺失／越组 ID 拒绝、成员与 active ID 不变、保存边界、搜索／窄栏禁拖、取消／卸载清理；真实视觉与命中验证另交 E2E 工作流。
- [x] 11. 实现常用站点置顶快捷入口，原组保留站点且共享选择；展示已有业务状态标记。Unit 覆盖置顶去重／取消、上下文隔离、失效清理、同身份双入口选择、无既有状态时不制造告警。
- [x] 12. 实现小于 768px 的窄屏抽屉、遮罩关闭、导航后关闭及桌面状态恢复。Unit 覆盖断点分支、抽屉关闭不覆盖桌面宽度、菜单／编辑不误关、监听清理；同步中文／英文界面文案。

## 收尾

- [x] 15. 根据用户 Chrome 对比图统一收起栏中心线、彩色圆角分组箭头和展开成员竖线；地形改造树保留独立折叠且不导航。Unit 覆盖图形控制、展开／收起、成员可见性与普通站点导航；实际外观由浏览器验收。
- [x] 16. 移除实况底部“＋”及仅服务该入口的新领域方法，蓝图保留添加。Unit 覆盖桌面、窄栏、抽屉不存在主入口，蓝图创建与已有绑定菜单继续可用。
- [x] 17. 移除上下分区、横向分割线和固定区／底部区百分比高度限制；顶部展开／收起按钮和蓝图“＋”固定两端，中间所有内容共用一个滚动容器。Unit 覆盖蓝图／实况、展开／收起及抽屉的容器边界、滚动恢复和两端按钮行为；执行 focused Unit 与 `npm run build`，浏览器几何不以 Unit 代替。
- [x] 18. 修正展开／收起图标抖动及顶部按钮左边距不一致；采用固定图标列、稳定行高和不占导航布局空间的拖拽手柄。保持组折叠、Transit 导航、菜单和蓝图添加合同，重跑 focused Unit 与构建；实际几何交浏览器验收。
- [ ] 19. 移除当前项与含当前项分组的左侧半月形／inset 竖条高亮，保留背景、文字及分组成员颜色竖线。纯样式调整，沿用 focused 组件测试验证导航／活动身份不变并运行构建。

- [x] 13. 检查 request/spec/design/tasks 与最终实现一致；检查涉及侧栏的 Vue 均通过 presenter 获取展示数据和触发行为，无新增中间层、跨组移动、新建分组入口或快捷键体系；按实际结果更新任务状态。
- [x] 14. 执行受影响的 focused Unit，并运行 `npm run build`。编译错误需修复后重跑至通过或记录明确阻塞；不运行 build-rust。记录命令、结果与未验证边界。

E2E 不在此任务列表中实施或运行。交互验收由 `/x4:e2e-test sidebar` 单独生成 `e2e_tests.md` / `e2e_test_tasks.md` 并推进，不能把本次文档完成或 Unit 通过写成真实浏览器交互已验证。

## Apply 验证记录（2026-10-02）

- 安装源码与包版本核查：vuedraggable 4.1.0、SortableJS 1.14.0；没有新增拖拽依赖。
- `npm run test:unit -- tests/unit/sidebar/sidebar-state.spec.ts tests/unit/sidebar/sidebar-presenter.spec.ts tests/unit/sidebar/sidebar-domain.spec.ts tests/unit/sidebar/sidebar-component.spec.ts tests/unit/production/blueprint-save-active-identity.spec.ts`：5 files、40 tests passed，exit 0。
- 取消生命周期补充后重跑 `npm run test:unit -- tests/unit/sidebar/sidebar-component.spec.ts tests/unit/sidebar/sidebar-presenter.spec.ts`：2 files、22 tests passed，exit 0。
- drawer 锚点收尾后重跑 `npm run test:unit -- tests/unit/sidebar/sidebar-component.spec.ts`：1 file、8 tests passed，exit 0。
- Store／presenter／Vue 接线审查与 `git diff --check` 通过。工作区其余历史 store 直连不在本次清理范围。
- 实现中发现并修复的问题记录于 `bugs.md`；最终验证状态留给 `/x4:verify sidebar`。
- 未运行全量 Unit、Playwright／E2E 或 build-rust。Unit 中的 DOM／排序事件是局部合同验证，不是浏览器真实拖动证据；tooltip 可见性、影像／占位几何、真实命中、最终滚动视窗与抽屉遮挡交 `/x4:e2e-test sidebar`。
- 最终 `npm run build`：exit 0，Vite 构建 15.18s；TypeScript 与兼容检查通过。仅保留已有 chunk size warning；构建日志 `/tmp/sidebar-final-build.log`。

## 用户反馈修正验证（2026-10-02 20:10）

- 同步 request/spec/design/tasks：实况无底部主入口；Chrome 式彩色圆角分组箭头、展开成员竖线与窄栏统一中心线。
- 修复前 focused 组件测试复现：实况按钮仍存在、顶部无图形折叠控制；随后树测试复现独立折叠按钮缺失。相关缺陷记录见 `bugs.md`。
- `npm run test:unit -- tests/unit/sidebar/sidebar-component.spec.ts tests/unit/sidebar/sidebar-presenter.spec.ts tests/unit/sidebar/sidebar-domain.spec.ts`：3 files、30 tests passed，exit 0。
- 未执行 E2E、全量 Unit 或 build-rust；实际视觉不以 jsdom 合同测试替代。
- 上下分区及固定区 55% 高度上限是实现选择，不能视为用户提出“分割为上下两半”；本轮已说明来源，未依据询问自行改变滚动策略。
- 本轮最终 `npm run build`：exit 0，Vite 16.17s，兼容检查与 TypeScript 通过；构建日志 `/tmp/sidebar-feedback-build.log`，保留已有 chunk size warning。

## 统一滚动与固定图标列验证（2026-10-02 20:22）

- request/spec/design/tasks 已同步确认：顶部按钮固定、蓝图“＋”固定底部，其余内容共用一个滚动容器；删除上下分区、横向分割线及百分比高度限制。
- 修复前 `npm run test:unit -- tests/unit/sidebar/sidebar-component.spec.ts`：2 failed、10 passed；新增蓝图／实况容器边界用例均确认顶部按钮仍位于原功能区容器，日志 `/tmp/sidebar-scroll-red.log`。
- 完成统一滚动及图标列修正后，`npm run test:unit -- tests/unit/sidebar/sidebar-component.spec.ts tests/unit/sidebar/sidebar-presenter.spec.ts`：2 files、26 tests passed，exit 0；覆盖桌面展开／收起、抽屉、蓝图添加、实况无“＋”、滚动恢复和已有导航／菜单／拖动提交合同。
- 图标偏移修正属于布局样式：共享固定 32px 主图标中心线，导航行高恒定，手柄不占布局空间；Unit 保证交互合同，未用 jsdom 宣称真实几何或视觉抖动已验证。
- 最终 `npm run build`：exit 0，Vite 16.16s，兼容检查与 TypeScript 通过；日志 `/tmp/sidebar-final-layout-build.log`，保留已有 chunk size warning。
- `git diff --check` 通过。未运行 E2E、全量 Unit 或 build-rust；未提交代码。
