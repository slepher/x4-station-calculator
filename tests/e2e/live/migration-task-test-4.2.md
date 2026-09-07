# M4.2 Contribution / Gap / Live Flow Map迁移

状态：implemented，待主agent审核。原20case全部保留；当前完整20/20pass（exit0，1.3m），最终collection20/3files exit0。没有业务store写入、helper/src/基础fixture改动，保留debug。

共同迁移：loadLiveBindingFixture不改；移除固定waitForTimeout与重复模式兜底点击，直接证明fixture初始planning。使用当前station id/sectorMacro定位。旧Live Flow Map是Live生产数据流验证文件，不把名字中的Map当成已验证地图导航功能。

| 原文件/顺序 | 原目的与当前真实动作 | 独立expected / 迁移 |
|---|---|---|
| contribution 1、4、6 | HUB资源/运输/总览反物质展开 | 名称新建空间站；新增明细.name唯一精确匹配，不能只外层文字包含 |
| contribution 2 | KXN显示缺口并展开电子基质 | 明细名称地球人唯一 |
| contribution 3 | HUB仓储反物质展开 | 参与空间站区域可见，保留原目的 |
| contribution 5 | 虚拟站量子管缺口展开 | 量子管产线、励磁线圈产线。原标题说sector名但原断言已是module名；按one-flow-contribution类型对应名称解析，未伪造sector级贡献 |
| gap 1 | RWC电子黏土UI设100产生缺口；虚拟站+量子管，后- | 原模块不存在→恰1→移除；缺口改善/恢复，别站plans不变，减号禁用。补回原只断言数字不同的目标身份缺口 |
| live-flow 1 | KXN规划模块/auto区域 | 规划恰3个fixture产线，不包含auto能源/仓储；自动工业能源存在 |
| live-flow 2 | KXN live四ware，展开能源明细 | 三产品正/能源负、各一flow；实际展开.list-item=3，无能源自产。原.detail-row不存在且未展开，0≤3是假阳性 |
| live-flow 3、4 | 有archive715/虚拟HUB切mode | 有archive标签及色live；虚拟trade请求live但保持planning有效数据色，保留当前规范分支 |
| live-flow 5、6、8、10 | 有/无archive切建造区 | 有archive切readonly ArchiveModuleList且非空；无archive保留planning内容及module数 |
| live-flow 7 | KXN live dashboard | cost展示；更强archive8/plan10及auto锁定由M4.1同一行为独立证据覆盖，不复制 |
| live-flow 9 | RWC100电子黏土→715 transit planning/live/back | 用真实claytronics flow值，live低于明确100规划输入、切回恢复。删除旧不存在.ware-flow-row且count>=0的空断言 |
| live-flow 11、12、13 | 715 toolbar sunlight/resource/popover | maps.json阳光1.41→141%；map_resources六种；名称阿尔忒弥斯的朦胧；由宽泛范围改独立精确值 |

baseline4项（contribution1/gap1/live-flow2/9）exit0/4pass/21.6s，旧center/detail假阳性仍需迁移后验证，不能据baseline认完成。所有日志与旧spec副本在/tmp/x4-migration-M4.2/。
