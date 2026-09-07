# 实现约束

先读已安装vuedraggable对list/modelValue与add/remove的实际处理顺序；复用其受控模式，不复制数组状态、不以手动删DOM掩盖错误，不重写拖放框架。修正原有绑定不新增Vue业务路径；确需新展示组装才入局部presenter。store只承担zone/flags/status/events。

正常drop恰一项移动；auto/isolate目标占位只转状态且每zone同ID仅一项；重复/拒绝不损坏源目标；合法锁定允许drop。历史spec中add与drop命名不一致，本修复不擅自统一事件名，保留当前drop事务验收及报告未决差异。无新定时器/fallback/强制DOM删除。
