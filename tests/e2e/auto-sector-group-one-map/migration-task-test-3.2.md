# M3.2 Map 分组迁移

状态：incomplete；当前13项有效witness汇总11通过、2产品失败（由完整与最后focused联合覆盖，非单轮计数）。13 个当前 UI 事务替代 37 个旧 test 函数，不以旧 2 pass 冒充验收。原任务叶子编号完整保留在 OpenSpec e2e_test_tasks.md，全部历史通过标记已撤回。未覆盖细项列于下文，不因合并自动通过。

共享输入：只读 loadLiveBindingFixture(page)，其 db.json 注入/reload/UI language 与当前 IndexedDB archive 输入不复制、不改写。beforeEach 仅把当前版本持久化 binding.appliedAutoGroupArchiveTime 设置为所选 A 的 667632.933，再 reload。两个覆盖冲突/未分组 fixture 只修改持久化 groups 或 stationPlan.sectorMacro；所有创建、移动、删除、排序、命名来源选择、设色、确认均经 UI。断言读取 store/localStorage，不调用算法生成 expected。

规范优先：较新 binding-mode/draft 的查看/编辑/重算、无 Exit、共享 draft 跨上下文与确认后工作台保留，替代旧确认隐藏 tabs/旧 calculationBaseline。sectorMacro 是 group 身份。颜色透明必须清空 undefined，不接受 #00000000；2/3 半径仍严格按 color spec，当前产品并不满足。

## 原编号 → 当前事务与独立 oracle

| 原 spec 编号 / 原文档编号 | 当前 UI 动作与 expected | 当前 test 标题关键词 |
|---|---|---|
| 1.1、1.2、1.3、1.4；4.1、4.5；7.1、7.2 | Live 入口→Map；四页签中英切换；edit 写入红色后切换/关闭重开 groups 保持；查看仍可打开 virtual tab；Live 无 virtual tab；旧 panel 不渲染 | 四页签中英切换 |
| 1.5；旧 spec 3.3 | 确认仍保留当前工作台 tabs、无自动导航；confirm 在编辑态可见。旧隐藏 tabs/确认专用按钮路线被较新 binding mode 替代；不是恢复旧 UI | 色卡预设与透明色、预设非透明颜色 |
| 2.1、2.2、2.3 | 点击 Mercury coverage / HUB anchor 前后 bbox 真变化且居中；panel≤360px、pill 不溢出；Live 点击 viewport 保持 | 地图coverage和anchor定位 |
| 2.4 | Map 添加菜单为侧栏，定位真实移动地图；Live 为 overlay 且无定位按钮。当前 map spec 定义 focus emit，不要求旧任务自加菜单关闭 | Map侧栏定位菜单 |
| 2.5 | 两个完整 persisted group 经 handle Mouse 拖放；释放前 placeholder；顺序精确交换且每组完整内容不变；确认保存新顺序 | group handle排序 |
| 3.1、3.2 | 16px 色块、预设红色及 map fill；透明 UI 后 draft/saved/reload 必须 undefined；透明边框 dashed；非透明红色独立 confirm/reload | 色卡预设与透明色、预设非透明颜色 |
| 旧 spec 3.4 | calculate 后 edited color 按 anchor 保留的旧目的尚待执行；不以设色或 tab 保持替代 | 待执行 |
| 旧 spec 3.5 / 文档 3.3 | draft 红色立即进入对应两个 sector fill；普通地图不渲染 group color | 颜色只在binding显示 |
| 旧 spec 3.6 / 文档 3.4 | faction/group/sector(resource) 顺序；HUB fill 与外六边形同心且半径比必须2/3；普通地图无 hub route | 颜色只在binding显示 |
| 4.2、4.3；5.2、5.3、5.5、5.6、7.4 | 空白来源真实 drop：industrial/modules[]/locked[]/priority{}、新 id；真实再次移动仅位置变化且数量不变；删除只改 draft；非 virtual tab overlay 仍见；列表顺序与当前 groups 一致 | 空白真实创建 |
| 4.4、4.5.3 | fixture 虚拟生产站在 Mercury；UI jump=0 成未分组并有提交移除说明；jump=3 恢复同 id/group/sector | 未分组区域显示 |
| 5.1、4.2 | 选 Empire1/E1-S1 并 Mouse 拖放；id不复制、无saveStationCode、claytronics6/hullparts12、settings 明确字段、locked quantumtubes/priority{}；四个对象引用独立；saved不变 | 从蓝图真实拖放 |
| 5.4.1 | UI jump=0 排除 Mercury；列表站拖至真实 Mercury polygon，释放前无 preview，释放后 draft 完全不变 | 无覆盖sector拒绝 |
| 5.4.2、7.3 | 两组 persisted coverage 同含 Mercury；先证明命中两组，再真实拖放；不选第一组/最近组 | 多group覆盖拒绝 |
| 6.1–6.5 | 已存 virtual trade overlay 真实同 HUB 移动；group anchor/coverage、生产 draft、saved不变；切 player 候选隐藏、切 virtual 显示；坐标按新 position 格式显示；向相邻 Mars 释放拒绝；confirm/reload恢复新 position | virtual trade overlay真实拖动 |
| 7.5 | 生产 map 目录 readonly rg 无 MapBindingSectorGroup/MapBindingPanel 引用；UI 无旧 binding-sector-group。静态搜索另存日志，不以静态源码文本替代行为 | 四页签中英切换 + static.log |

## 有效细项待执行（未尝试不是 blocked）

- 1.3.3 从另一 map layer 返回原 binding-sector 的 draft 保持（当前只覆盖 panel close/open）。
- 2.1.3 assignment sector 独立 focus，以及原 2.1 总述 candidate/connected/trade station focus。
- 2.3.3 compact 相对 Live 的 padding/header/label/gap/jump-row 比较；当前只覆盖尺寸和不溢出。
- 原 spec 3.4 calculate 保持 edited color（按更新的重算/重新计算动作）。
- 3.1.3 初始无色 group 的虚线色块、3.4.2 无色 group 无 fill；透明设色有严格失败，不可替代无色初始输入。
- 4.3.3 row 不含 group name 的专门 oracle（当前明确检查 name/sector/坐标/删除，未把正向字段称为完整负向验证）。
- 5.1.3 完整 settings 值复制：当前指定 sunlight/racePreference/resourceBufferHours/showEmpireGaps 并检查对象引用独立，其余 settings 字段未逐项断言。

## 拖放迁移与保留失败

原拖放 case 多为直接 store 调用或只检查列表。现在统一真实 mouse down→移动4/20 steps→验证 dragging/hover→mouse up。只用 evaluate 读取 DOM box 与 elementFromPoint 选可命中点，不发 synthetic drag、不写业务。初始固定百分比命中站图标而非 polygon；精确 hit-test 修复后空白和蓝图都通过。调试输出 [M3.2-drag-target] 保留。

Virtual trade 拒绝路线先 focus Mercury 导致源离屏；缩至全图导致目标太小被 overlay 遮挡；maps.json 显示 Mars 与 HUB 相邻，改为 HUB focus 下拖至 Mars，真实命中已证实。overlay 路径可显示落点 preview，规范只要求 release 后拒绝，因此撤掉本轮自加“拒绝时无 preview”并以 mouse up 后位置不变作为业务 oracle。列表虚拟站拒绝路径的无 preview 是不同实现，不混同。

所有历史日志保留于 /tmp/x4-migration-M3.2/，结果含准确 exit/count/trace。未改 helper/src/基础fixture，未 build、未提交。

### 本轮后续 schema / release oracle 校正

- 多组 fixture 的 persisted coverage 为 `{ref, jump}`，runtime 才是string数组；修正测试数据，不改 normalize 产品。
- 多组 union coverage 会显示 preview；归属唯一性在 release 校验。断言改为真实 preview→释放→draft完整不变，严格保留拒绝行为。
- reload 后通过 top-view-btn-live-production 回到 Live 再进入 Map，避免在 Map 查不存在的 Live 侧栏。
- trade commit 保存路径为 group.tradeStation.position；runtime virtualTradeStationPosition 不属于持久化字段。
- confirm 会将旧 UUID groupId 规范化为 sectorMacro、去除旧 count/lastUpdated 元数据、补默认 settings。拖动期间仍要求 draft/saved 完全不变；confirm后检查每个原站全部业务字段和原settings值、站点总数、按原group对应的 canonical groupId，允许规范化新增默认字段。不把历史JSON字节相同作为当前业务要求。
