# module-id 测试任务

## 1 单元测试
- [✓] 1.1 Empire v2 到 v3 迁移归一 module id
  - [✓] 1.1.1 构造 `version=2` 且 `modules[].id` 为 macro id 的 empire 输入
  - [✓] 1.1.2 调用 Empire 迁移函数并读取迁移结果
  - [✓] 1.1.3 断言迁移后版本为 3 且模块 ID 全部可在 modulesMap 命中 #期望: [3, true]

- [✓] 1.2 Flow v1 到 v2 迁移归一 moduleId
  - [✓] 1.2.1 构造 `version=1` 且 `nodes[].moduleId` 为 macro id 的 flow 输入
  - [✓] 1.2.2 调用 Flow 迁移函数并读取迁移结果
  - [✓] 1.2.3 断言迁移后版本为 2 且节点 moduleId 可命中 modulesMap #期望: [2, true]

- [✓] 1.3 Import coerce 与 migrate 职责分离
  - [✓] 1.3.1 构造带 `version=2` 的 empire 导入包
  - [✓] 1.3.2 调用 coerce 后检查版本未被改写
  - [✓] 1.3.3 调用 migrate 后检查升级到最新版本 #期望: [2, 3]

## 2 E2E 标准状态与状态迁移
- [✓] 2.1 状态: empire-v2-macro
  - [✓] 2.1.1 预置仅含旧 macro id 的 Empire 导入文件
  - [✓] 2.1.2 打开 storage-import 流程并完成文件解析
  - [✓] 2.1.3 解析后 `storage-import-module-x4_empire_data` 可见，且导入样例 JSON 的 `x4_empire_data.version` 为 2 #期望: [true, 2]

- [✓] 2.2 切换: empire-v2-macro -> empire-v3-module
  - [✓] 2.2.1 在覆盖模式执行 Empire 导入
  - [✓] 2.2.2 读取 `x4_empire_data` 并检查版本与模块 ID
  - [✓] 2.2.3 导入后版本升级为 3 且模块 ID 为 module id #期望: [3, true]

- [✓] 2.3 状态: flow-v1-macro
  - [✓] 2.3.1 预置仅含旧 macro id 的 Flow 导入文件
  - [✓] 2.3.2 打开 storage-import 流程并勾选 Flow 模块
  - [✓] 2.3.3 解析后 `storage-import-module-x4_logic_flow_plans` 可见，且导入样例 JSON 的 `x4_logic_flow_plans.version` 为 1 #期望: [true, 1]

- [✓] 2.4 切换: flow-v1-macro -> flow-v2-module
  - [✓] 2.4.1 在覆盖模式执行 Flow 导入
  - [✓] 2.4.2 读取 `x4_logic_flow_plans` 并检查版本与节点 moduleId
  - [✓] 2.4.3 导入后版本升级为 2 且节点 moduleId 为 module id #期望: [2, true]

## 3 E2E 测试场景
- [✓] 3.1 Case: 导入 Empire 旧版本后自动迁移到最新
  - [✓] 3.1.1 状态: empire-v2-macro
  - [✓] 3.1.2 切换: empire-v2-macro -> empire-v3-module
  - [✓] 3.1.3 执行导入后校验站点模块列表中不存在 `_macro` 后缀 ID #期望: [0]

- [✓] 3.2 Case: 导入 Flow 旧版本后自动迁移到最新
  - [✓] 3.2.1 状态: flow-v1-macro
  - [✓] 3.2.2 切换: flow-v1-macro -> flow-v2-module
  - [✓] 3.2.3 执行导入后校验节点 moduleId 不含 `_macro` 后缀 #期望: [0]

- [✓] 3.3 Case: 导出总是输出最新版本
  - [✓] 3.3.1 切换: empire-v2-macro -> empire-v3-module
  - [✓] 3.3.2 先导入旧版本数据再执行导出
  - [✓] 3.3.3 校验导出 JSON 中 Empire 与 Flow 版本为最新 #期望: [3, 2]

- [✓] 3.4 Case: XML 与 x4-game 输入统一归一 module id
  - [✓] 3.4.1 状态: empire-v2-macro
  - [✓] 3.4.2 分别导入 XML macro 输入与 x4-game module 输入
  - [✓] 3.4.3 校验写入站点模块 ID 均为 module id #期望: [true]

## 4 Bug 测试
- [✓] 4.1 BUG-001: 导入旧版本 JSON 后 Empire 版本未升级
  - [✓] 4.1.1 状态: empire-v2-macro
  - [✓] 4.1.2 通过 `storage-import-file-input` 上传旧 Empire JSON，勾选 Empire 模块并点击 `storage-import-mode-overwrite` + `storage-import-apply-btn`
  - [✓] 4.1.3 修复前/修复后: 按同一导入路径执行后 `x4_empire_data.version` 分别为 2/3 #期望: [2, 3]
