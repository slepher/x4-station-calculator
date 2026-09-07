# M4.3 Live工具栏迁移

状态：implemented，待主agent审核。保留原14case，新增planning/live各一名称保存事务，共16；当前完整16/16pass，exit0，1.1m。共享helper只读，无src/fixture改动，无业务store写入，无debug删除。

|原编号/目的|当前行为与独立expected|
|---|---|
|Fixture load；3.3、3.9|PPW-916来自A archive且无原plan，默认live、可切换、规划控件隐藏；保留严格UI断言|
|3.1、3.2、3.4|KXN双来源默认planning可切；虚拟站仅plan禁切；双向mode标签/样式/控件可见性|
|第一个3.10（virtual环境）|固定fixture虚拟站位置67.5/0/81.3km，HUB阳光13%、七资源，名称小行星带；UI弹层展示，原精确断言不减|
|3.5、3.6、3.7|只读code精确KXN-018；PPW坐标-39.5/0/8.8km；资源弹层无input|
|3.8 controls editable|真实select teladi、workforce ON、gaps ON；当前KXN三个settings准确；toolbar保存→reload→原目标仍三值，不再只验按钮文本变化|
|第二个3.10（transit站仍在列表）；3.11|BHW-834在715站列表一次，RWC id/name正确|
|transit group name|HUB原名小行星，改测试名称、离开返回；toolbar保存到当前group，bindingName仍slepher、其他groups及stationPlans完整不变；reload恢复测试名称|
|新增station name planning/live|KXN名字在两模式各自失焦提交draft→toolbar保存→reload；只该plan.name变化，其余plan业务字段/别站/groups/bindingName/archive KXN输入不变，id始终KXN-018|

模式选择分支由固定测试参数planning/live决定，不按观察失败降级。固定wait全部改当前UI条件。旧station helper name→id fallback改显式PPW-916映射，不依赖模糊回退。

持久化按当前save-binding规范的用户保存绑定动作验证；字段失焦先更新draft，不把旧toolbar“自动保存”表述扩张为必须自动写localStorage。本轮没有修改产品保存时机。

baseline：原3.3/3.8/transit名称3pass exit0，17.3s。当前完整16pass exit0，1.1m。collection16/2files exit0，owned diffcheck0。日志/tmp/x4-migration-M4.3/，正常Chromium sandbox，PORT22243 preview-only/workers1/retries0/trace。无产品失败或原目的待执行项；不声称所有toolbar排版数值算法均已验证。
