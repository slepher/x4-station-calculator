# Context Toolbar 高度异常分析

## 现象

`context-toolbar`（h-16, 64px）在滚动条出现时高度坍缩为 40px（input-group 的 h-10），滚动条消失时恢复正常 64px。

## 定位链

```
production-content (flex flex-col overflow-y-auto)  ← 滚动容器
  ├── context-toolbar (h-16 flex px-6)               ← 64px 固定高度，flex row
  │     ├── toolbar-content (flex items-center)      ← 水平居中，高度由子元素撑
  │     │     └── toolbar-section (flex items-center h-full)
  │     │           └── input-group (flex flex-col justify-end h-10)  ← 40px
  │     └── toolbar-import-slot (flex items-end h-10)
  └── main-layout grid ...                           ← 触发滚动的长内容
```

## 根因

WebKit 的已知 bug：当 flex 父容器同时设置 `overflow-y: auto` 且出现滚动条时，其直系 flex 子元素上的 **百分比高度（h-full）无法解析父级的固定高度（h-16）**，回退到 `auto`。

此时 `toolbar-content` 的 `h-full` 失效 → `toolbar-section` 的 `h-full` 也失效 → 最终高度坍缩到 `input-group` 的 `h-10`（40px）。

滚动条消失 → overflow 状态下百分比高度正常解析 → 恢复 64px。

## 已实施的修复

`context-toolbar` 从 `flex items-center` 改为 `flex`（默认 stretch），去掉 `toolbar-content` 上的 `h-full`。

- 修复前：父级 `items-center` 垂直居中 → 子级需要 `h-full` 撑满 → scrollbar 触发了 % bug
- 修复后：父级默认 `stretch` → 子级自动拉伸到 64px → 不依赖百分比高度 → 不受 overflow 影响
