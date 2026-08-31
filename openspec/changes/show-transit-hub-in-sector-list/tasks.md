# show-transit-hub-in-sector-list Tasks

## Implementation

- [x] 1. 移除 `liveStationResolver.ts` 中 transit hub 排除逻辑
  - [x] 1.1 删除 `tradestationCodes` 集合构建（L126-131）
  - [x] 1.2 删除 `if (tradestationCodes.has(code)) return` 跳过逻辑（L140）

- [x] 2. Build validation
  - [x] 2.1 运行 `npm run build`
  - [x] 2.2 编译通过，无错误

- [x] 3. 运行单元测试
  - [x] 3.1 运行 `npm run test:unit`
  - [x] 3.2 无新增失败（现有失败均为 pre-existing）
