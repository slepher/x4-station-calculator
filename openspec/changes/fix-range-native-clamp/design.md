# 最小实现

使用已有toNumber规范化逻辑同步HTMLInputElement.value，emit/commit同一值。不得引入watch补丁、定时器、重建key、额外状态或将max改为dragMax。通用原生UI事件适配不需要领域presenter；不修改调用者业务政策。

先真实mounted重复越界红例，再验证mouse/change/touch仅一次commit、无dragMax与step透传、prop更新和卸载。实际浏览器鼠标仍为独立验收阶段。
