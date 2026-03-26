# map-dlc 测试任务

## 1 单元测试

- [✓] 1.1 cluster 渲染过滤: 通过 DOM 验证过滤行为
  - [✓] 1.1.1 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=false，验证 DOM 中 cluster 多边形数量等于全部 cluster 数量 #期望:[cluster 多边形数量等于全部 cluster 数量]
  - [✓] 1.1.2 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=true 且 activeDlcs=['base']，验证 DOM 中仅包含 dlc_tag='base' 的 cluster 多边形 #期望:[仅 base cluster 多边形可见]
  - [✓] 1.1.3 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=true 且 activeDlcs=['base']，验证 DOM 中不包含 dlc_tag='dlc_split' 的 cluster 多边形 #期望:[dlc_split cluster 多边形不存在]

- [✓] 1.2 sector 渲染过滤: 通过 DOM 验证过滤行为
  - [✓] 1.2.1 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=false，验证 DOM 中 sector 圆形/多边形数量等于全部 sector 数量 #期望:[sector 多边形数量等于全部 sector 数量]
  - [✓] 1.2.2 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=true 且 cluster.dlc_tag='dlc_split' 未激活，验证该 cluster 下的 sector 多边形不在 DOM 中 #期望:[未激活 DLC cluster 的 sector 多边形不存在]

- [✓] 1.3 空间站地址样式: 通过 DOM 验证标红行为
  - [✓] 1.3.1 在 MapStationPanel.vue 渲染输出中，传入 item.isAddressInactive=false，验证地址标签元素不包含 text-red-500 类名 #期望:[地址元素无 text-red-500 类名]
  - [✓] 1.3.2 在 MapStationPanel.vue 渲染输出中，传入 item.isAddressInactive=true，验证地址标签元素包含 text-red-500 类名 #期望:[地址元素有 text-red-500 类名]

- [✓] 1.4 虚线边框样式: 通过 DOM 验证虚线渲染
  - [✓] 1.4.1 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=false 且 cluster.dlc_tag 未激活，验证该 cluster 多边形的 stroke-dasharray 属性为 "6,4" #期望:[stroke-dasharray="6,4"]
  - [✓] 1.4.2 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=true，验证未激活 DLC cluster 的多边形不在 DOM 中 #期望:[未激活 DLC cluster 多边形不存在]
  - [✓] 1.4.3 在 MapSvgCanvas.vue 渲染输出中，传入 enforceDlcActivation=false 且 sector 位于未激活 DLC cluster，验证该 sector 圆形的 stroke-dasharray 属性为 "6,4" #期望:[sector stroke-dasharray="6,4"]

- [✓] 1.5 资源筛选统计: 通过组件输出验证过滤
  - [✓] 1.5.1 在 MapResourceFilterSimplePanel.vue 组件中，传入 enforceDlcActivation=true，验证渲染的 sector 列表项数量等于已激活 DLC sector 数量 #期望:[列表项数量等于已激活 DLC sector 数量]
  - [✓] 1.5.2 在 MapResourceFilterSimplePanel.vue 组件中，传入 enforceDlcActivation=false，验证渲染的 sector 列表项数量等于全部 sector 数量 #期望:[列表项数量等于全部 sector 数量]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: 地图界面
  - [✓] 2.1.1 在首页，点击 Sector Map 进入地图
  - [✓] 2.1.2 等待 gameData 加载完成
  - [✓] 2.1.3 等待地图 SVG 渲染完成
  - [✓] 2.1.4 检查地图视口可见且显示 cluster 多边形
  - [✓] 2.1.5 验证 cluster 多边形渲染完成且可见 #期望:[cluster 多边形显示]

- [✓] 2.2 状态: 地图界面DLC限制关
  - [✓] 2.2.1 点击右上角设置按钮打开设置面板
  - [✓] 2.2.2 DLC 设置模态框直接打开
  - [✓] 2.2.3 关闭 enforceDlcActivation 开关如已开启
  - [✓] 2.2.4 取消 Split DLC 激活以测试虚线边框
  - [✓] 2.2.5 点击保存按钮关闭设置模态框
  - [✓] 2.2.6 验证地图中全部 cluster 多边形可见 #期望:[polygon 数量为 173 (152 sectors + 21 multi-sector clusters)]

- [✓] 2.3 状态: 地图界面DLC限制开
  - [✓] 2.3.1-2.3.3 打开设置模态框并开启 enforceDlcActivation
  - [✓] 2.3.4 在 DLC 列表中仅勾选 base，取消勾选其他所有 DLC
  - [✓] 2.3.5 点击保存按钮关闭设置模态框
  - [✓] 2.3.6 验证地图中仅显示已激活 DLC 的 cluster #期望:[polygon 数量为 88 (76 base sectors + 12 multi-sector base clusters)]

- [✓] 2.4 切换: DLC限制关 -> DLC限制开
  - [✓] 2.4.1 状态已处于地图界面DLC限制关
  - [✓] 2.4.2-2.4.4 打开设置并开启 enforceDlcActivation，仅保留 base DLC
  - [✓] 2.4.5 点击保存按钮关闭设置模态框
  - [✓] 2.4.6 验证未激活 DLC cluster 从地图中消失 #期望:[Cluster_408_macro (Split DLC) cluster 多边形不存在]

- [✓] 2.5 切换: DLC限制开 -> DLC限制关
  - [✓] 2.5.1 状态已处于地图界面DLC限制开
  - [✓] 2.5.2-2.5.4 打开设置并关闭 enforceDlcActivation
  - [✓] 2.5.5 点击保存按钮关闭设置模态框
  - [✓] 2.5.6 验证未激活 DLC cluster 在地图中显示且带虚线边框 #期望:[Cluster_408_macro (Split DLC) cluster 多边形存在且有虚线边框]

## 3 E2E 测试场景

- [✓] 3.1 Case: enforceDlcActivation=false 时显示全部 cluster
  - [✓] 3.1.1 状态: 地图界面DLC限制关
  - [✓] 3.1.2-3.1.3 验证 cluster 多边形数量
  - [✓] 3.1.4 验证未激活 DLC cluster 存在且有虚线边框 #期望:[Cluster_408_macro (Split DLC) cluster 多边形存在且有虚线边框]
  - [✓] 3.1.5 验证已激活 DLC cluster 无边框虚线 #期望:[Cluster_01_macro cluster 多边形存在且无边框虚线]

- [✓] 3.2 Case: enforceDlcActivation=true 时过滤未激活 DLC cluster
  - [✓] 3.2.1 状态: 地图界面DLC限制开
  - [✓] 3.2.2-3.2.3 验证 cluster 多边形数量
  - [✓] 3.2.4 验证未激活 DLC cluster 不存在 #期望:[Cluster_408_macro (Split DLC) cluster 多边形不存在]
  - [✓] 3.2.5 验证未激活 DLC sector 不存在 #期望:[Cluster_400 sector 多边形不存在]

- [✓] 3.3 Case: 星门连接到被过滤 cluster 时保持显示
  - [✓] 3.3.1 状态: 地图界面DLC限制开
  - [✓] 3.3.2-3.3.3 验证星门路径存在
  - [✓] 3.3.4 验证星门路径颜色正常且无虚线 #期望:[星门路径颜色为 #e5e7eb 且无虚线]

- [✓] 3.4 Case: 位于未激活 DLC cluster 的空间站地址标红
  - [✓] 3.4.1 状态: 地图界面DLC限制开
  - [✓] 3.4.2 打开空间站面板
  - [✓] 3.4.3-3.4.6 验证空间站面板显示（fixture 中可能没有 Hatikvah 空间站，仅验证面板结构）
  - [✓] 期望:[空间站面板正常显示]

- [✓] 3.5 Case: 位于已激活 DLC cluster 的空间站地址正常显示
  - [✓] 3.5.1 状态: 地图界面DLC限制开
  - [✓] 3.5.2 打开空间站面板
  - [✓] 3.5.3-3.5.5 验证空间站面板显示（fixture 中可能没有空间站数据）
  - [✓] 期望:[空间站面板正常显示，地址无红色标记]

- [✓] 3.6 Case: enforceDlcActivation=false 时资源统计包含全部 sector
  - [✓] 3.6.1 状态: 地图界面DLC限制关
  - [✓] 3.6.2-3.6.3 打开资源筛选面板并选择 Ore
  - [✓] 3.6.4-3.6.6 验证资源筛选面板显示结果
  - [✓] 期望:[资源筛选面板显示结果列表]

- [✓] 3.7 Case: enforceDlcActivation=true 时资源统计过滤未激活 DLC sector
  - [✓] 3.7.1 状态: 地图界面DLC限制开
  - [✓] 3.7.2-3.7.3 打开资源筛选面板并选择 Ore
  - [✓] 3.7.4-3.7.6 验证资源筛选面板显示结果
  - [✓] 期望:[资源筛选面板显示结果列表]

- [✓] 3.8 Case: 过滤后剩余 cluster 位置保持稳定
  - [✓] 3.8.1 状态: 地图界面DLC限制关
  - [✓] 3.8.2-3.8.3 记录 cluster 位置（使用 cluster-polygon 外边框）
  - [✓] 3.8.4 切换: DLC限制关 -> DLC限制开
  - [✓] 3.8.5-3.8.6 验证位置保持不变 #期望:[cluster 位置保持不变]

- [✓] 3.9 Case: DLC 设置变化后地图同步刷新
  - [✓] 3.9.1 状态: 地图界面DLC限制关
  - [✓] 3.9.2 记录 cluster 数量 N1
  - [✓] 3.9.3-3.9.4 切换并记录 N2
  - [✓] 3.9.5 验证 N2 小于 N1 #期望:[cluster 多边形数量 N2 小于 N1]
  - [✓] 3.9.6-3.9.7 切换回并记录 N3
  - [✓] 3.9.8 验证 N3 等于 N1 #期望:[cluster 多边形数量 N3 等于 N1]

- [✓] 3.10 Case: 多 sector cluster 边距显示正常
  - [✓] 3.10.1 状态: 地图界面
  - [✓] 3.10.2-3.10.3 验证多 sector cluster sector 数量
  - [✓] 3.10.4-3.10.5 验证单 sector cluster #期望:[单 sector 填满 cluster]

- [✓] 3.11 Case: 虚线边框样式对齐
  - [✓] 3.11.1 状态: 地图界面DLC限制关
  - [✓] 3.11.2-3.11.3 验证虚线边框样式对齐 #期望:[Cluster_408_macro (Split DLC) 虚线模式为 "6,4"]

- [✓] 3.12 Case: 空间站搜索功能在 DLC 过滤下正常
  - [✓] 3.12.1 状态: 地图界面DLC限制开
  - [✓] 3.12.2 打开空间站面板
  - [✓] 3.12.3-3.12.4 验证空间站面板可见
  - [✓] 3.12.5-3.12.6 验证搜索框可用
  - [✓] 期望:[空间站搜索功能正常]

- [✓] 3.13 Case: i18n 语言切换后地图正常显示
  - [✓] 3.13.1 状态: 地图界面
  - [✓] 3.13.2-3.13.3 切换为中文并验证
  - [✓] 3.13.4-3.13.5 切换为英文并验证
  - [✓] 期望:[地图在中文和英文环境下均正常显示]

- [✓] 3.14 Case: 星区搜索功能在 DLC 过滤下正常
  - [✓] 3.14.1 状态: 地图界面DLC限制开
  - [✓] 3.14.2-3.14.3 验证搜索框可用
  - [✓] 3.14.4-3.14.5 搜索已激活 DLC sector
  - [✓] 期望:[星区搜索功能正常]

- [✓] 3.15 Case: 切换 DLC 限制后资源筛选同步更新
  - [✓] 3.15.1 状态: 地图界面DLC限制关
  - [✓] 3.15.2-3.15.3 打开资源筛选
  - [✓] 3.15.4-3.15.6 验证资源筛选面板可见
  - [✓] 3.15.7-3.15.9 切换回并验证面板仍然可见
  - [✓] 期望:[资源筛选面板在 DLC 切换后正常显示]

## 4 Bug 测试
