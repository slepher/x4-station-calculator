# Test Tasks: ship-items

## 1 单元测试

- [✓] 1.1 无人机匹配逻辑测试
  - [✓] 1.1.1 输入: ship.droneTags=[], 运行匹配逻辑
  - [✓] 1.1.2 断言 结果包含 droneTags=[] 的无人机 #期望: [ship_gen_s_fightingdrone_01_a]
  - [✓] 1.1.3 断言 结果不包含 noplayerblueprint=true 的无人机 #期望: [true]
  - [✓] 1.1.4 断言 结果不包含 deployable=true 的无人机 #期望: [true]
- [✓] 1.2 导弹匹配逻辑测试
  - [✓] 1.2.1 输入: blueprint无weapon/turret, 运行匹配逻辑
  - [✓] 1.2.2 断言 结果为空数组 #期望: [0]
  - [✓] 1.2.3 输入: ammunitionTags=["dumbfire"], 运行匹配逻辑
  - [✓] 1.2.4 断言 结果包含 missileTags 包含 dumbfire 的导弹 #期望: [true]
- [✓] 1.3 存储上限计算测试
  - [✓] 1.3.1 运行 deployableTotal 计算
  - [✓] 1.3.2 断言 total ≤ ship.storage.deployable #期望: [true]
  - [✓] 1.3.3 运行 droneTotal 计算
  - [✓] 1.3.4 断言 total ≤ ship.storage.unit #期望: [true]
  - [✓] 1.3.5 运行 missileTotal 计算
  - [✓] 1.3.6 断言 total ≤ ship.storage.missile #期望: [true]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: ship-fit-loaded
  - [✓] 2.1.1 在 ship-build 页面
  - [✓] 2.1.2 点击选择飞船下拉框
  - [✓] 2.1.3 选择 Osaka 飞船
  - [✓] 2.1.4 断言 槽位标签显示 C槽和U槽 #期望: [true]
  - [✓] 2.1.5 断言 槽位顺序为 E→R→S→W→T→C→U #期望: [true]
- [✓] 2.2 切换: ship-fit-loaded -> consumables-selected
  - [✓] 2.2.1 状态: ship-fit-loaded
  - [✓] 2.2.2 点击 C槽 标签
  - [✓] 2.2.3 断言 标题显示"可部署"区域 #期望: [true]
  - [✓] 2.2.4 断言 标题显示"诱导弹"区域 #期望: [true]
- [✓] 2.3 切换: consumables-selected -> units-selected
  - [✓] 2.3.1 状态: consumables-selected
  - [✓] 2.3.2 点击 U槽 标签
  - [✓] 2.3.3 断言 C槽区域不显示 #期望: [true]
  - [✓] 2.3.4 断言 显示"无人机"区域 #期望: [true]

## 3 E2E 测试场景

- [✓] 3.1 Case: C槽可部署物品配置
  - [✓] 3.1.1 状态: ship-fit-loaded
  - [✓] 3.1.2 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.1.3 切换: ship-fit-loaded -> consumables-selected
  - [✓] 3.1.4 对可部署物品滑块，拖动到位置 100
  - [✓] 3.1.5 断言 滑块显示值为 100 #期望: ['100']
  - [✓] 3.1.6 断言 显示总量 100/250 #期望: ['100 / 250']
- [✓] 3.2 Case: C槽诱导弹配置
  - [✓] 3.2.1 状态: ship-fit-loaded
  - [✓] 3.2.2 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.2.3 切换: ship-fit-loaded -> consumables-selected
  - [✓] 3.2.4 对诱导弹滑块，拖动到位置 10
  - [✓] 3.2.5 断言 滑块显示值为 10 #期望: ['10']
- [✓] 3.3 Case: U槽无人机配置
  - [✓] 3.3.1 状态: ship-fit-loaded
  - [✓] 3.3.2 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.3.3 切换: consumables-selected -> units-selected
  - [✓] 3.3.4 断言 显示战斗无人机 ship_gen_s_fightingdrone_01_a #期望: [true]
  - [✓] 3.3.5 对无人机滑块，拖动到位置 5
  - [✓] 3.3.6 断言 显示总量 5/10 #期望: ['5 / 10']
- [✓] 3.4 Case: U槽导弹配置-有武器
  - [✓] 3.4.1 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.4.2 在 W槽 配置武器 (具有 ammunitionTags)
  - [✓] 3.4.3 切换: consumables-selected -> units-selected
  - [✓] 3.4.4 断言 显示 missiles 区域 #期望: [true]
  - [✓] 3.4.5 对导弹滑块，拖动到位置 20
  - [✓] 3.4.6 断言 显示总量 20/160 #期望: ['20 / 160']
- [✓] 3.5 Case: U槽导弹隐藏-无武器
  - [✓] 3.5.1 在 ship-build 页面，选择 Osaka 飞船不配置武器
  - [✓] 3.5.2 切换: ship-fit-loaded -> units-selected
  - [✓] 3.5.3 断言 不显示 missiles 区域 #期望: [false]
- [✓] 3.6 Case: 存储数据持久化
  - [✓] 3.6.1 状态: ship-fit-loaded
  - [✓] 3.6.2 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.6.3 选择 C槽，配置可部署物品数量为 50
  - [✓] 3.6.4 刷新页面
  - [✓] 3.6.5 重新选择 Osaka 飞船
  - [✓] 3.6.6 选择 C槽
  - [✓] 3.6.7 断言 可部署物品数量为 50 #期望: ['50']
- [✓] 3.7 Case: 另存为保留存储数据
  - [✓] 3.7.1 状态: ship-fit-loaded
  - [✓] 3.7.2 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.7.3 选择 C槽，配置可部署物品数量为 30
  - [✓] 3.7.4 点击另存为，输入名称 "Test Blueprint"
  - [✓] 3.7.5 断言 新 blueprint 显示可部署物品数量为 30 #期望: ['30']
- [✓] 3.8 Case: C槽存储达到上限
  - [✓] 3.8.1 状态: ship-fit-loaded
  - [✓] 3.8.2 在 ship-build 页面，选择 Osaka 飞船
  - [✓] 3.8.3 切换: ship-fit-loaded -> consumables-selected
  - [✓] 3.8.4 对多个可部署物品分别配置数量，使总量达到 250
  - [✓] 3.8.5 断言 显示总量为 250/250 #期望: ['250 / 250']
  - [✓] 3.8.6 对新增可部署物品拖动滑块
  - [✓] 3.8.7 断言 新物品dragMax为0 #期望: [0]

## 4 Bug 测试

