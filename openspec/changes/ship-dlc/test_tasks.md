# ship-dlc 测试任务

## 1 单元测试

- [✓] 1.1 isDlcActive helper: DLC 激活状态判定
  - [✓] 1.1.1 在 useGameDataStore 模块中，对 isDlcActive(dlcTag) 函数，传入 'base'，验证返回 true #期望:[返回 true]
  - [✓] 1.1.2 在 useGameDataStore 模块中，对 isDlcActive(dlcTag) 函数，传入已激活 DLC 的 tag 且该 tag 在 activeDlcs 列表中，验证返回 true #期望:[返回 true]
  - [✓] 1.1.3 在 useGameDataStore 模块中，对 isDlcActive(dlcTag) 函数，传入未激活 DLC 的 tag 且该 tag 不在 activeDlcs 列表中，验证返回 false #期望:[返回 false]

- [✓] 1.2 filterActiveDlcItems: 未激活 DLC 过滤
  - [✓] 1.2.1 在 useGameDataStore 模块中，对 filterActiveDlcItems(items) 函数，传入包含 base 和已激活 DLC 物品的混合数组且 enforceDlcActivation=true，验证返回结果包含全部物品 #期望:[返回全部物品]
  - [✓] 1.2.2 在 useGameDataStore 模块中，对 filterActiveDlcItems(items) 函数，传入包含未激活 DLC 物品的数组且 enforceDlcActivation=true，验证返回结果过滤掉未激活 DLC 物品 #期望:[未激活 DLC 物品被过滤]
  - [✓] 1.2.3 在 useGameDataStore 模块中，对 filterActiveDlcItems(items) 函数，传入包含未激活 DLC 物品的数组且 enforceDlcActivation=false，验证返回结果保留未激活 DLC 物品 #期望:[返回全部物品]

- [✓] 1.3 getDlcDisplayName: DLC 名称 i18n 解析
  - [✓] 1.3.1 在 useGameDataStore 模块中，对 getDlcDisplayName(dlcTag) 函数，传入 'base'，验证返回空字符串或 undefined #期望:[返回空值]
  - [✓] 1.3.2 在 useGameDataStore 模块中，对 getDlcDisplayName(dlcTag) 函数，传入有效 DLC tag 且 i18n 存在对应翻译，验证返回本地化名称 #期望:[返回 i18n 翻译结果]

- [ ] 1.4 shipCandidate 计算属性:舰船候选过滤
  - [ ] 1.4.1 在 ship selector 组件中，对 computedShipCandidates 计算属性，传入包含未激活 DLC 舰船的列表且 enforceDlcActivation=true，验证返回结果过滤掉未激活 DLC 舰船 #期望:[未激活 DLC 舰船被过滤]
  - [ ] 1.4.2 在 ship selector 组件中，对 computedShipCandidates 计算属性，传入包含未激活 DLC 舰船的列表且 enforceDlcActivation=false，验证返回结果保留未激活 DLC 舰船 #期望:[保留全部舰船]
  - [ ] 1.4.3 在 ship selector 组件中，对 computedShipCandidates 计算属性，验证返回结果中 base 舰船的 dlc 标签不显示 #期望:[base 舰船无 DLC 标签]

- [ ] 1.5 equipmentCandidate 计算属性:装备候选过滤
  - [ ] 1.5.1 在 equipment picker 组件中，对 computedEquipmentCandidates 计算属性，传入包含未激活 DLC 装备的列表且 enforceDlcActivation=true，验证返回结果过滤掉未激活 DLC 装备 #期望:[未激活 DLC 装备被过滤]
  - [ ] 1.5.2 在 equipment picker 组件中，对 computedEquipmentCandidates 计算属性，传入包含未激活 DLC 装备的列表且 enforceDlcActivation=false，验证返回结果保留未激活 DLC 装备 #期望:[保留全部装备]

- [ ] 1.6 blueprintAutoPick: 预设蓝图自动选装过滤
  - [ ] 1.6.1 在 preset blueprint 生成逻辑中，对 autoPickEquipment 函数，传入包含未激活 DLC 装备的候选池，验证返回结果不包含未激活 DLC 装备 #期望:[未激活 DLC 装备被过滤]
  - [ ] 1.6.2 在 preset blueprint 生成逻辑中，对 autoPickEquipment 函数，验证过滤逻辑与 enforceDlcActivation 开关无关 #期望:[始终过滤未激活 DLC 装备]

- [ ] 1.7 filterInactiveDlcEquipment: 装备禁算过滤 helper
  - [ ] 1.7.1 在 ship stats 计算模块中，对 filterInactiveDlcEquipment(equippedItems) 函数，传入包含未激活 DLC 装备的已装备列表且 enforceDlcActivation=true，验证返回结果过滤掉未激活 DLC 装备 #期望:[未激活 DLC 装备被过滤]
  - [ ] 1.7.2 在 ship stats 计算模块中，对 filterInactiveDlcEquipment(equippedItems) 函数，传入包含未激活 DLC 装备的已装备列表且 enforceDlcActivation=false，验证返回结果保留未激活 DLC 装备 #期望:[保留全部装备]

- [ ] 1.8 shipStats 计算:未激活 DLC 装备禁算
  - [ ] 1.8.1 在 shipStats 计算逻辑中，对 weaponBurst 统计，传入包含未激活 DLC 武器模块的装备列表且 enforceDlcActivation=true，验证该武器不参与 burst 计算 #期望:[burst 值不包含未激活 DLC 武器贡献]
  - [ ] 1.8.2 在 shipStats 计算逻辑中，对 shieldMax 统计，传入包含未激活 DLC 护盾模块的装备列表且 enforceDlcActivation=true，验证该护盾不参与 max 计算 #期望:[shieldMax 值不包含未激活 DLC 护盾贡献]
  - [ ] 1.8.3 在 shipStats 计算逻辑中，对 engineSpeed 统计，传入包含未激活 DLC 引擎模块的装备列表且 enforceDlcActivation=true，验证该引擎不参与 speed 计算 #期望:[engineSpeed 值不包含未激活 DLC 引擎贡献]

- [ ] 1.9 equipmentDiff 计算:未激活 DLC 装备禁算
  - [ ] 1.9.1 在 equipmentDiff 计算逻辑中，对比当前装备与候选装备，当当前装备所属 DLC 未激活且 enforceDlcActivation=true，验证该装备不纳入 diff 计算 #期望:[diff 结果不包含未激活 DLC 装备]
  - [ ] 1.9.2 在 equipmentComparison 计算逻辑中，对比多个装备配置，当某配置包含未激活 DLC 装备且 enforceDlcActivation=true，验证该配置不参与 comparison #期望:[comparison 结果不包含未激活 DLC 装备]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态:舰船选择界面
  - [✓] 2.1.1 在舰船建造页面，点击新建舰船按钮
  - [✓] 2.1.2 等待舰船选择界面渲染完成
  - [✓] 2.1.3 检查舰船候选列表渲染完成
  - [✓] 2.1.4 验证舰船候选列表显示且每个非 base 舰船名称右侧显示 DLC 标签 #期望:[舰船列表可见，DLC 标签正确显示]

- [✓] 2.2 状态:装备选择器打开
  - [✓] 2.2.1 在舰船配装界面，点击任意装备槽位的编辑按钮
  - [✓] 2.2.2 等待装备 picker 面板展开
  - [✓] 2.2.3 检查装备候选列表渲染完成
  - [✓] 2.2.4 验证装备候选列表显示且每个非 base 装备名称右侧显示 DLC 标签 #期望:[装备列表可见，DLC 标签正确显示]

- [✓] 2.3 状态:DLC标签激活态
  - [✓] 2.3.1 在舰船选择界面，定位到已激活 DLC 的舰船
  - [✓] 2.3.2 检查该舰船右侧的 DLC 标签样式
  - [✓] 2.3.3 验证标签边框为绿色且文字为绿色 #期望:[绿色边框，绿色文字]

- [✓] 2.4 状态:DLC标签未激活态
  - [✓] 2.4.1 在舰船选择界面，定位到未激活 DLC 的舰船
  - [✓] 2.4.2 检查该舰船右侧的 DLC 标签样式
  - [✓] 2.4.3 验证标签边框为红色且文字为红色 #期望:[红色边框，红色文字]

- [✓] 2.5 状态:DLC限制关
  - [✓] 2.5.1 在 DLC 设置中，关闭 enforceDlcActivation 开关
  - [✓] 2.5.2 返回舰船选择界面
  - [✓] 2.5.3 验证舰船候选列表显示全部舰船（包括未激活 DLC 舰船） #期望:[未激活 DLC 舰船可见]

- [✓] 2.6 状态:DLC限制开
  - [✓] 2.6.1 在 DLC 设置中，开启 enforceDlcActivation 开关
  - [✓] 2.6.2 返回舰船选择界面
  - [✓] 2.6.3 验证舰船候选列表不显示未激活 DLC 舰船 #期望:[未激活 DLC 舰船不可见]

- [ ] 2.7 状态:装备候选DLC 限制关
  - [ ] 2.7.1 在 DLC 设置中，关闭 enforceDlcActivation 开关
  - [ ] 2.7.2 打开装备 picker
  - [ ] 2.7.3 验证装备候选列表显示全部装备（包括未激活 DLC 装备） #期望:[未激活 DLC 装备可见]

- [ ] 2.8 状态:装备候选DLC 限制开
  - [ ] 2.8.1 在 DLC 设置中，开启 enforceDlcActivation 开关
  - [ ] 2.8.2 打开装备 picker
  - [ ] 2.8.3 验证装备候选列表不显示未激活 DLC 装备 #期望:[未激活 DLC 装备不可见]

- [ ] 2.9 状态:当前舰船失效
  - [ ] 2.9.1 在 DLC 设置中，关闭某个已选舰船所属的 DLC
  - [ ] 2.9.2 开启 enforceDlcActivation 开关
  - [ ] 2.9.3 返回舰船建造页面
  - [ ] 2.9.4 验证页面自动返回舰船选择界面，不显示配装工作台 #期望:[页面处于舰船选择界面]

- [ ] 2.10 切换:DLC限制关到开
  - [ ] 2.10.1 在 DLC 设置面板中，enforceDlcActivation 处于关闭状态
  - [ ] 2.10.2 点击 enforceDlcActivation 开关使其开启
  - [ ] 2.10.3 等待设置生效
  - [ ] 2.10.4 验证舰船候选列表和装备候选列表同步过滤未激活 DLC 物品 #期望:[未激活 DLC 物品被过滤]

- [ ] 2.11 切换:DLC限制开到关
  - [ ] 2.11.1 在 DLC 设置面板中，enforceDlcActivation 处于开启状态
  - [ ] 2.11.2 点击 enforceDlcActivation 开关使其关闭
  - [ ] 2.11.3 等待设置生效
  - [ ] 2.11.4 验证舰船候选列表和装备候选列表恢复显示全部物品 #期望:[全部物品可见]

- [ ] 2.12 切换:舰船工作台到选择界面
  - [ ] 2.12.1 在舰船配装工作台，当前舰船已配置若干装备
  - [ ] 2.12.2 在 DLC 设置中关闭当前舰船所属 DLC 并开启 enforceDlcActivation
  - [ ] 2.12.3 返回舰船建造页面
  - [ ] 2.12.4 验证页面自动返回舰船选择界面 #期望:[页面处于舰船选择界面，工作台不可见]

## 3 E2E 测试场景

- [✓] 3.1 Case: DLC 标签显示与样式语义
  - [✓] 3.1.1 状态:舰船选择界面
  - [✓] 3.1.2 检查 base 舰船的 DLC 标签显示
  - [✓] 3.1.3 验证 base 舰船不显示 DLC 标签 #期望:[base 舰船无标签]
  - [✓] 3.1.4 检查已激活 DLC 舰船的标签样式
  - [✓] 3.1.5 验证已激活 DLC 舰船标签为绿色边框和绿色文字 #期望:[绿色边框，绿色文字]
  - [✓] 3.1.6 检查未激活 DLC 舰船的标签样式
  - [✓] 3.1.7 验证未激活 DLC 舰船标签为红色边框和红色文字 #期望:[红色边框，红色文字]
  - [✓] 3.1.8 检查装备 picker 中的 DLC 标签
  - [✓] 3.1.9 切换到装备 picker，验证装备标签样式语义一致 #期望:[装备标签样式与舰船一致]

- [✓] 3.2 Case: enforceDlcActivation=false 时舰船候选完整显示
  - [✓] 3.2.1 状态:DLC限制关
  - [✓] 3.2.2 记录当前舰船候选列表中的舰船数量
  - [✓] 3.2.3 检查候选列表中是否包含未激活 DLC 舰船
  - [✓] 3.2.4 验证未激活 DLC 舰船可见且通过红色标签标识 #期望:[未激活 DLC 舰船可见，标签为红色]
  - [✓] 3.2.5 验证 race/type 计数包含未激活 DLC 舰船 #期望:[计数包含全部舰船]

- [✓] 3.3 Case: enforceDlcActivation=true 时舰船候选过滤
  - [✓] 3.3.1 状态:DLC限制开
  - [✓] 3.3.2 记录当前舰船候选列表中的舰船数量
  - [✓] 3.3.3 检查候选列表中是否包含未激活 DLC 舰船
  - [✓] 3.3.4 验证未激活 DLC 舰船不可见 #期望:[未激活 DLC 舰船不在列表中]
  - [✓] 3.3.5 验证 race/type 计数不包含未激活 DLC 舰船 #期望:[计数仅包含已激活 DLC 舰船]

- [ ] 3.4 Case: enforceDlcActivation=false 时装备候选完整显示
  - [ ] 3.4.1 状态:装备候选DLC 限制关
  - [ ] 3.4.2 状态：装备选择器打开
  - [ ] 3.4.3 记录当前装备候选列表中的装备数量
  - [ ] 3.4.4 检查候选列表中是否包含未激活 DLC 装备
  - [ ] 3.4.5 验证未激活 DLC 装备可见且通过红色标签标识 #期望:[未激活 DLC 装备可见，标签为红色]
  - [ ] 3.4.6 验证 race/mk/tag facet 统计包含未激活 DLC 装备 #期望:[facet 统计包含全部装备]

- [ ] 3.5 Case: enforceDlcActivation=true 时装备候选过滤
  - [ ] 3.5.1 状态:装备候选DLC 限制开
  - [ ] 3.5.2 打开装备 picker
  - [ ] 3.5.3 记录当前装备候选列表中的装备数量
  - [ ] 3.5.4 检查候选列表中是否包含未激活 DLC 装备
  - [ ] 3.5.5 验证未激活 DLC 装备不可见 #期望:[未激活 DLC 装备不在列表中]
  - [ ] 3.5.6 验证 race/mk/tag facet 统计不包含未激活 DLC 装备 #期望:[facet 统计仅包含已激活 DLC 装备]

- [ ] 3.6 Case: 预设蓝图自动选装始终过滤未激活 DLC 装备
  - [ ] 3.6.1 状态:舰船选择界面
  - [ ] 3.6.2 在 DLC 设置中关闭某个装备所属 DLC
  - [ ] 3.6.3 选择一艘舰船并生成预设蓝图（enforceDlcActivation=false）
  - [ ] 3.6.4 等待预设蓝图生成完成
  - [ ] 3.6.5 检查生成的蓝图中的装备配置
  - [ ] 3.6.6 验证预设蓝图不包含未激活 DLC 装备 #期望:[蓝图中无未激活 DLC 装备]
  - [ ] 3.6.7 开启 enforceDlcActivation，重新生成预设蓝图
  - [ ] 3.6.8 验证预设蓝图仍不包含未激活 DLC 装备 #期望:[蓝图中无未激活 DLC 装备]

- [ ] 3.7 Case: 当前舰船 DLC 失效后自动返回选择界面
  - [ ] 3.7.1 状态:当前舰船失效
  - [ ] 3.7.2 在 DLC 设置中关闭当前舰船所属 DLC
  - [ ] 3.7.3 开启 enforceDlcActivation 开关
  - [ ] 3.7.4 等待页面状态收敛
  - [ ] 3.7.5 验证页面自动返回舰船选择界面 #期望:[页面显示舰船选择界面，工作台不可见]
  - [ ] 3.7.6 检查 localStorage 中蓝图数据
  - [ ] 3.7.7 验证蓝图数据未被删除，仅当前编辑状态回退 #期望:[蓝图数据保留]

- [ ] 3.8 Case: 未激活 DLC 装备保留在蓝图但不参与属性计算
  - [ ] 3.8.1 状态:装备候选DLC 限制开
  - [ ] 3.8.2 在 enforceDlcActivation=false 时为舰船配置包含未激活 DLC 装备的蓝图
  - [ ] 3.8.3 开启 enforceDlcActivation
  - [ ] 3.8.4 检查舰船属性面板
  - [ ] 3.8.5 验证未激活 DLC 装备仍显示在已装备列表中 #期望:[装备配置保留]
  - [ ] 3.8.6 检查舰船属性统计结果（如 weaponBurst、shieldMax）
  - [ ] 3.8.7 验证属性统计不包含未激活 DLC 装备的贡献 #期望:[属性值不包含未激活 DLC 装备贡献]

- [ ] 3.9 Case: 未激活 DLC 装备不参与 diff/comparison
  - [ ] 3.9.1 状态:装备候选DLC 限制开
  - [ ] 3.9.2 在 enforceDlcActivation=false 时为舰船配置包含未激活 DLC 装备的蓝图
  - [ ] 3.9.3 开启 enforceDlcActivation
  - [ ] 3.9.4 打开装备 diff/comparison 面板
  - [ ] 3.9.5 验证 diff 结果不包含未激活 DLC 装备 #期望:[diff 不显示未激活 DLC 装备]
  - [ ] 3.9.6 验证 comparison 结果不包含未激活 DLC 装备 #期望:[comparison 不显示未激活 DLC 装备]

- [ ] 3.10 Case: DLC 设置变化后候选列表同步刷新
  - [ ] 3.10.1 状态:DLC限制关
  - [ ] 3.10.2 记录当前舰船候选列表内容
  - [ ] 3.10.3 切换:DLC限制关到开
  - [ ] 3.10.4 验证舰船候选列表立即刷新，未激活 DLC 舰船被过滤 #期望:[列表内容变化，未激活 DLC 舰船消失]
  - [ ] 3.10.5 切换:DLC限制开到关
  - [ ] 3.10.6 验证舰船候选列表立即刷新，未激活 DLC 舰船恢复显示 #期望:[列表内容变化，未激活 DLC 舰船恢复]

- [ ] 3.11 Case: DLC 标签文案使用游戏 i18n
  - [ ] 3.11.1 状态:舰船选择界面
  - [ ] 3.11.2 切换应用语言为简体中文
  - [ ] 3.11.3 检查 DLC 标签文案
  - [ ] 3.11.4 验证标签文案为中文本地化文本 #期望:[标签显示中文 DLC 名称]
  - [ ] 3.11.5 切换应用语言为 English
  - [ ] 3.11.6 验证标签文案为英文本地化文本 #期望:[标签显示英文 DLC 名称]

- [ ] 3.12 Case: 舰船 race 过滤与 DLC 过滤叠加
  - [ ] 3.12.1 状态:DLC限制开
  - [ ] 3.12.2 选择某个 race 过滤条件（如 Argon）
  - [ ] 3.12.3 验证候选列表显示该 race 且已激活 DLC 的舰船 #期望:[候选为 Argon 且已激活 DLC 的舰船]
  - [ ] 3.12.4 验证未激活 DLC 的 Argon 舰船不在列表中 #期望:[未激活 DLC 的 Argon 舰船不可见]

- [ ] 3.13 Case: 装备 race 过滤与 DLC 过滤叠加
  - [ ] 3.13.1 状态:装备候选DLC 限制开
  - [ ] 3.13.2 选择某个 race 过滤条件（如 Argon）
  - [ ] 3.13.3 验证候选列表显示该 race 且已激活 DLC 的装备 #期望:[候选为 Argon 且已激活 DLC 的装备]
  - [ ] 3.13.4 验证未激活 DLC 的 Argon 装备不在列表中 #期望:[未激活 DLC 的 Argon 装备不可见]

- [ ] 3.14 Case: 装备 mk 过滤与 DLC 过滤叠加
  - [ ] 3.14.1 状态:装备候选DLC 限制开
  - [ ] 3.14.2 选择某个 mk 等级过滤条件（如 MK3）
  - [ ] 3.14.3 验证候选列表显示该 mk 且已激活 DLC 的装备 #期望:[候选为 MK3 且已激活 DLC 的装备]
  - [ ] 3.14.4 验证未激活 DLC 的 MK3 装备不在列表中 #期望:[未激活 DLC 的 MK3 装备不可见]

- [ ] 3.15 Case: enforceDlcActivation 切换影响舰船候选
  - [ ] 3.15.1 状态:DLC限制关
  - [ ] 3.15.2 切换:DLC限制关到开
  - [ ] 3.15.3 验证舰船候选列表过滤未激活 DLC 舰船 #期望:[未激活 DLC 舰船不可见]
  - [ ] 3.15.4 切换:DLC限制开到关
  - [ ] 3.15.5 验证舰船候选列表恢复显示未激活 DLC 舰船 #期望:[未激活 DLC 舰船可见]

- [ ] 3.16 Case: enforceDlcActivation 切换影响装备候选
  - [ ] 3.16.1 状态:装备候选DLC 限制关
  - [ ] 3.16.2 切换:DLC限制关到开
  - [ ] 3.16.3 验证装备候选列表过滤未激活 DLC 装备 #期望:[未激活 DLC 装备不可见]
  - [ ] 3.16.4 切换:DLC限制开到关
  - [ ] 3.16.5 验证装备候选列表恢复显示未激活 DLC 装备 #期望:[未激活 DLC 装备可见]

- [ ] 3.17 Case: 舰船工作台到选择界面自动返回
  - [ ] 3.17.1 状态:当前舰船失效
  - [ ] 3.17.2 在 DLC 设置中关闭当前舰船所属 DLC
  - [ ] 3.17.3 开启 enforceDlcActivation 开关
  - [ ] 3.17.4 切换:舰船工作台到选择界面
  - [ ] 3.17.5 验证页面处于舰船选择界面 #期望:[页面显示舰船选择界面]

## 4 Bug 测试
