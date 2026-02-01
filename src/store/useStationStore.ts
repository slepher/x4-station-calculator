import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { mockStationData, type SavedModule } from '@/mock/mock_data_v1'
import type { X4Module, X4Ware, X4ModuleGroup, WareAmountMap } from '../types/x4'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/useX4I18n'
import { loadLanguageAsync } from '@/i18n'

// 1. 静态导入游戏数据
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import ModulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import moduleGroupsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/module_groups.json'
import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'

export interface PlannedModuleDisplay extends SavedModule {
  nameId: string;    
  cost: number;      
  buildCost: WareAmountMap; 
}

export const useStationStore = defineStore('station', () => {
  const { locale: currentLocale } = useI18n();
  const { translateModule, translateModuleGroup } = useX4I18n();
  
  // --- 状态 (State) ---
  const isReady = ref(false)
  const plannedModules = ref<SavedModule[]>([])
  const savedLayouts = ref<{
    version: number;
    activeId: string | null;
    list: Array<{
      id: string;
      name: string;
      modules: SavedModule[];
      settings: any;
      description: string;
      lastUpdated: number;
    }>;
  }>({ version: 1, activeId: null, list: [] });
  const searchQuery = ref('') // 全局搜索状态，驱动检索逻辑
  const localizedModulesMap = ref<Record<string, X4Module & { localeName: string }>>({});
  const localizedModuleGroupsMap = ref<Record<string, X4ModuleGroup & { localeName: string }>>({});

  // --- 脏检查快照 (Dirty Check) ---
  // 存储最后一次保存或加载时的 JSON 字符串，用于物理级对比
  const lastSavedSnapshot = ref<string>('')

  const settings = ref({
    sunlight: 100, // 强制初始值为 100%
    useHQ: false,           
    manualWorkforce: 0,      
    workforcePercent: 100,  
    workforceAuto: true,    
    considerWorkforceForAutoFill: false, // 自动填充时是否考虑工人加成
    buyMultiplier: 0.5,      
    sellMultiplier: 0.5,     
    minersEnabled: false,    
    internalSupply: false
  })

  // --- 基础数据映射 (Computed Maps) ---
  const waresMap = computed(() => {
    const map: Record<string, X4Ware> = {}
    const raw = waresRaw as any[]
    raw.forEach(w => {
      map[w.id] = { ...w, price: w.price || 0, minPrice: w.minPrice || 0, maxPrice: w.maxPrice || 0 }
    })
    return map
  })

  const modulesMap = computed(() => {
    const map: Record<string, X4Module> = {}
    ModulesRaw.forEach(m => {
      map[m.id] = {
        ...m,
        buildCost: m.buildCost || {},
        outputs: m.outputs || {},
        inputs: m.inputs || {},
        cycleTime: m.cycleTime || 0,
        workforce: {
          capacity: m.workforce?.capacity || 0,
          needed: m.workforce?.needed || 0,
          maxBonus: m.workforce?.maxBonus || 0
        }
      } as X4Module
    })
    return map
  })

  // --- 数据预热 (针对 EN 模式优化：不执行重复翻译计算) ---
  const prepareLocalizedData = () => {
    const isEn = currentLocale.value === 'en';
    const newModuleMap: Record<string, any> = {};

    ModulesRaw.forEach(m => {
      newModuleMap[m.id] = {
        ...m,
        // 如果是 en，直接同步 name 字段，不再进入 translate 查找开销
        localeName: isEn ? (m.name || '') : translateModule(m as any)
      };
    });
    localizedModulesMap.value = newModuleMap;

    const newModuleGroupsMap: Record<string, any> = {};
    moduleGroupsRaw.forEach((mg: any) => {
      newModuleGroupsMap[mg.id] = {
        ...mg,
        // 如果是 en，直接同步 name 字段，不再进入 translate 查找开销
        localeName: isEn ? (mg.name || '') : translateModuleGroup(mg)
      };
    });
    localizedModuleGroupsMap.value = newModuleGroupsMap;
  };

  watch(
    () => currentLocale.value, 
    async (newLang) => {
      await loadLanguageAsync(newLang);
      prepareLocalizedData();
    }, 
    { immediate: true }
  );

  // --- 搜索增强 (ID/Name/Locale 三重判定) ---
    const filteredModulesGrouped = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const isSearching = query.length > 0;
    const isEn = currentLocale.value === 'en';

    const groups: Record<string, any[]> = {};
    const typeMetadata: Record<string, { displayLabel: string; isHit: boolean }> = {};

    // 1. 预处理类型命中逻辑与 Header 补偿
    Object.keys(localizedModuleGroupsMap.value).forEach(typeId => {
      const mg = localizedModuleGroupsMap.value[typeId];
      if(!mg) return;
      const name = (mg.name || '').toLowerCase();
      const id = (mg.id || '').toLowerCase();
      const localeName = (mg.localeName || '').toLowerCase();
      let isHit = false;
      let displayLabel = mg.localeName;

      if (isSearching) {
        if (isEn) {
          // EN 模式：仅匹配 id 或 name
          const idHit = id.includes(query);
          const nameHit = name.includes(query);
          isHit = idHit || nameHit;
          if (idHit && !nameHit) displayLabel += ` (${mg.id})`;
        } else {
          // 非 EN 模式：匹配 id, name 或 localeName
          const localeHit = localeName.includes(query);
          const nameHit = name.includes(query);
          const idHit = id.includes(query);
          isHit = localeHit || nameHit || idHit;
          
          if (!localeHit) {
            if (nameHit) displayLabel += ` (${mg.name})`;
            else if (idHit) displayLabel += ` (${mg.id})`;
          }
        }
      }

      typeMetadata[typeId] = { displayLabel, isHit };
    });

    // 2. 遍历模块，结合类型命中状态进行级联过滤
    Object.values(localizedModulesMap.value).forEach(m => {
      const localeName = (m.localeName || '').toLowerCase();
      const originalName = (m.name || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      
      const typeInfo = typeMetadata[m.group] || { displayLabel: m.group, isHit: false };

      let moduleHit = false;
      if (isEn) {
        moduleHit = id.includes(query) || originalName.includes(query);
      } else {
        moduleHit = localeName.includes(query) || originalName.includes(query) || id.includes(query);
      }

      const isMatch = !isSearching || typeInfo.isHit || moduleHit;

      if (isMatch) {
        let label = m.localeName;
        if (isSearching) {
          const localeHit = !isEn && localeName.includes(query);
          const nameHit = originalName.includes(query);
          const idHit = id.includes(query);

          if (isEn) {
            if (idHit && !nameHit) label += ` (${m.id})`;
          } else {
            if (nameHit && !localeHit) label += ` (${m.name})`;
            else if (idHit && !localeHit && !nameHit) label += ` (${m.id})`;
          }
        }

        const type = m.group || 'others';
        if (!groups[type]) groups[type] = [];
        groups[type].push({ ...m, displayLabel: label, moduleGroup: localizedModuleGroupsMap.value[m.group] });
      }
    });

    const TYPE_PRIORITY: Record<string, number> = {
      production: 1,
      habitation: 2,
      storage: 3
    };

    return Object.keys(groups)
      .sort((a, b) => {
        const pA = TYPE_PRIORITY[a] || 99;
        const pB = TYPE_PRIORITY[b] || 99;
        if (pA !== pB) return pA - pB;
        return a.localeCompare(b);
      })
      .map(group => ({
        group,
        displayLabel: typeMetadata[group]?.displayLabel || group,
        modules: groups[group]
      }));
  });
  
  // --- 操作方法 (Actions) ---
  function loadData(source: any) {

    // 使用 JSON 序列化进行深拷贝，防止污染原始数据源
    savedLayouts.value = JSON.parse(JSON.stringify(source));
    if (savedLayouts.value.activeId) {
      const target = savedLayouts.value.list.find(l => l.id === savedLayouts.value.activeId);
      if (target) {
        plannedModules.value = JSON.parse(JSON.stringify(target.modules));
        settings.value = JSON.parse(JSON.stringify(target.settings));
      }
    }
    takeSnapshot()
  }

  function takeSnapshot() {
    // 将当前关键数据序列化为字符串作为对比基准
    lastSavedSnapshot.value = JSON.stringify({
      modules: plannedModules.value,
      settings: settings.value
    })
  }

  function loadDemoData() {
    loadData(mockStationData);
  }

  function saveCurrentLayout(name: string) {
    const layoutData = {
      id: savedLayouts.value.activeId || crypto.randomUUID(),
      name,
      modules: JSON.parse(JSON.stringify(plannedModules.value)),
      settings: JSON.parse(JSON.stringify(settings.value)),
      lastUpdated: Date.now()
    };

    // 保持与存储同步：保存前尝试从 localStorage 同步列表，防止多标签页冲突
    const stored = localStorage.getItem('x4_station_data');
    if (stored) {
      try {
        const remote = JSON.parse(stored);
        savedLayouts.value.list = remote.list || [];
      } catch (e) { /* ignore parse error */ }
    }

    const idx = savedLayouts.value.list.findIndex(l => l.id === layoutData.id);
    if (idx !== -1) savedLayouts.value.list[idx] = layoutData;
    else savedLayouts.value.list.push(layoutData);
    savedLayouts.value.activeId = layoutData.id;
    takeSnapshot();
  }

  // 计算属性：脏检查
  const isDirty = computed(() => {
    const current = JSON.stringify({
      modules: plannedModules.value,
      settings: settings.value
    })
    return current !== lastSavedSnapshot.value
  })

  function loadLayout(index: number) {
    const layout = savedLayouts.value.list[index];
    if (layout) {
      plannedModules.value = JSON.parse(JSON.stringify(layout.modules));
      settings.value = JSON.parse(JSON.stringify(layout.settings));
      savedLayouts.value.activeId = layout.id;
    }
  }

  function mergeLayout(index: number) {
    const layout = savedLayouts.value.list[index];
    if (layout) layout.modules.forEach(m => addModule(m.id, m.count));
  }

  function deleteLayout(index: number) {
    if (savedLayouts.value.list[index]?.id === savedLayouts.value.activeId) {
      savedLayouts.value.activeId = null;
    }
    savedLayouts.value.list.splice(index, 1);
  }

  watch(savedLayouts, (val) => {
    localStorage.setItem('x4_station_data', JSON.stringify(val));
  }, { deep: true });

  function addModule(id: string = '', count = 1) {
    if (id !== '' && !modulesMap.value[id]) return
    const existing = plannedModules.value.find(m => m.id === id && id !== '')
    if (existing) { existing.count += count } 
    else { plannedModules.value.push({ id, count }) }
  }

  function updateModuleId(index: number, newId: string) {
    if (index >= 0 && index < plannedModules.value.length) {
      plannedModules.value[index].id = newId
    }
  }

  function updateModuleCount(index: number, count: number) {
    if (index >= 0 && index < plannedModules.value.length) {
      const module = plannedModules.value[index];
      if(module) module.count = count;
    }
  }

  function removeModule(index: number) {
    if (index >= 0 && index < plannedModules.value.length) {
      plannedModules.value.splice(index, 1)
    }
  }

  function removeModuleById(id: string) {
    const index = plannedModules.value.findIndex(m => m.id === id)
    if (index !== -1) removeModule(index)
  }

  function clearAll() { 
    plannedModules.value = [];
    savedLayouts.value.activeId = null;
  }

  function importPlan(input: string) {
    const raw = input.trim();
    if (!raw) return;

    // Mode A: Parse XML content (construction plans)
    if (raw.startsWith('<') || raw.includes('xml version') || raw.includes('<entry')) {
      const matchMacro = /macro="([^"]+)"/g;
      let match;
      const counts: Record<string, number> = {};
      let totalFound = 0;
      while ((match = matchMacro.exec(raw)) !== null) {
        const macro = match[1];
        // 过滤掉武器、盾牌等升级组件，只统计站台模块本身
        if (macro.includes('turret_') || macro.includes('shield_') || macro.includes('missile_')) continue;
        counts[macro] = (counts[macro] || 0) + 1;
        totalFound++;
      }
      if (totalFound > 0) {
        clearAll();
        Object.entries(counts).forEach(([id, count]) => addModule(id, count));
        return;
      }
    }

    // Mode B: Parse x4-game.com Share Link
    let decoded = decodeURIComponent(raw);
    const urlMatch = /l=@?([^&]+)/.exec(decoded) || [null, decoded]; 
    let paramStr = urlMatch[1] || '';
    if (paramStr.startsWith('@')) paramStr = paramStr.substring(1);

    const parts = paramStr.split(/[;]+/);
    if(parts.length === 0) return;
    clearAll();
    parts.forEach(part => {
      if (!part.includes('$module-')) return;
      
      const idMatch = /\$module-([^,]+)/.exec(part);
      const countMatch = /count:(\d+)/.exec(part);
      
      if (idMatch) {
        let id = idMatch[1];
        const count = countMatch ? parseInt(countMatch[1], 10) : 1;
        
        // 策略1: 直接匹配
        if (modulesMap.value[id]) {
          addModule(id, count);
          return;
        }

        // 策略2: 尝试标准后缀
        if (modulesMap.value[`${id}_macro`]) {
          addModule(`${id}_macro`, count);
        return;
        }

        // 策略3: 简单转换 (module_X -> X_macro)
        const simpleConverted = id.replace('module_', '') + '_macro';
        if (modulesMap.value[simpleConverted]) {
          addModule(simpleConverted, count);
          return;
        }

        // 策略4: wareId 兜底
        const target = Object.values(modulesMap.value).find(m => m.wareId === id);
        if (target) addModule(target.id, count);
      }
    });
  }

  function getModuleInfo(id: string): X4Module {
    return modulesMap.value[id] || {
      id, wareId: '', nameId: id, type: 'unknown', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  // --- 业务计算逻辑 (接口完整性保障) ---
  function getDynamicPrice(wareId: string, isInput = false) {
    const ware = waresMap.value[wareId]
    if (!ware) return 0
    const multiplier = isInput ? settings.value.buyMultiplier : settings.value.sellMultiplier
    
    if (multiplier <= 0.5) {
      const t = multiplier * 2
      return ware.minPrice + (ware.price - ware.minPrice) * t
    } else {
      const t = (multiplier - 0.5) * 2
      return ware.price + (ware.maxPrice - ware.price) * t
    }
  }

  const constructionBreakdown = computed(() => {
    let totalCost = 0
    const totalMaterials: Record<string, number> = {}
    const moduleList: PlannedModuleDisplay[] = plannedModules.value.map(item => {
      const info = modulesMap.value[item.id]
      if (!info) return null
      let itemTotalCost = 0
      for (const [matId, amountPerModule] of Object.entries(info.buildCost)) {
        const totalAmount = amountPerModule * item.count
        itemTotalCost += totalAmount * (waresMap.value[matId]?.price || 0)
        totalMaterials[matId] = (totalMaterials[matId] || 0) + totalAmount
      }
      totalCost += itemTotalCost
      return { ...item, nameId: info.nameId || info.id, cost: itemTotalCost, buildCost: info.buildCost }
    }).filter((item): item is PlannedModuleDisplay => item !== null)
    return { moduleList, totalCost, totalMaterials }
  })

  const workforceBreakdown = computed(() => {
    let neededTotal = 0
    let capacityTotal = 0
    const neededList: any[] = []
    const capacityList: any[] = []

    if (settings.value.useHQ) {
      neededTotal += 200
      neededList.push({ id: 'player_hq', nameId: '{20102,2011}', count: 1, value: 200 })
    }

    plannedModules.value.forEach(item => {
      const info = modulesMap.value[item.id]
      if (!info) return
      if (info.workforce.needed > 0) {
        const val = info.workforce.needed * item.count
        neededTotal += val
        neededList.push({ id: item.id, nameId: info.nameId, count: item.count, value: val })
      }
      if (info.workforce.capacity > 0) {
        const val = info.workforce.capacity * item.count
        capacityTotal += val
        capacityList.push({ id: item.id, nameId: info.nameId, count: item.count, value: val })
      }
    })

    return {
      needed: { total: neededTotal, list: neededList },
      capacity: { total: capacityTotal, list: capacityList },
      diff: capacityTotal - neededTotal
    }
  })

  const actualWorkforce = computed(() => {
     const wf = workforceBreakdown.value
     const maxCapacity = wf.capacity.total
     if (settings.value.workforceAuto) {
       return Math.min(wf.needed.total, maxCapacity)
     }
     return Math.max(0, Math.min(settings.value.manualWorkforce, maxCapacity))
   })
 
   const efficiencyMetrics = computed(() => {
     const wf = workforceBreakdown.value
     if (wf.needed.total === 0) return { saturation: 0 }
     return { saturation: Math.min(1.0, actualWorkforce.value / wf.needed.total) }
   })
  
  const profitBreakdown = computed(() => {
    const wareDetails: Record<string, { production: number, consumption: number, list: any[] }> = {}
    const { saturation } = efficiencyMetrics.value
    const currentWf = actualWorkforce.value

    // 预处理所有生活物资 ID 集合，用于后续过滤工业模块的静态 inputs
    const lifeWareIds = new Set<string>();
    Object.values(consumptionRaw).forEach((raceData: any) => {
      Object.keys(raceData.wares || raceData).forEach(id => lifeWareIds.add(id));
    });

    plannedModules.value.forEach(item => {
      const info = modulesMap.value[item.id]
      if (!info) return

      const currentBonusRatio = saturation * (info.workforce?.maxBonus || 0)
      const moduleEff = 1.0 + currentBonusRatio

      for (const [wareId, hourlyAmount] of Object.entries(info.outputs)) {
        if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] }
        const actualAmount = hourlyAmount * item.count * moduleEff
        wareDetails[wareId].production += actualAmount
        wareDetails[wareId].list.push({
          moduleId: item.id, nameId: info.nameId, count: item.count, amount: actualAmount,
          bonusPercent: Math.round(currentBonusRatio * 100), type: 'production'
        })
      }

      for (const [wareId, hourlyAmount] of Object.entries(info.inputs)) {
        if (lifeWareIds.has(wareId)) continue; // 跳过由工人驱动的物资
        if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] }
        const actualAmount = hourlyAmount * item.count
        wareDetails[wareId].consumption += actualAmount
        wareDetails[wareId].list.push({
          moduleId: item.id, nameId: info.nameId, count: item.count, amount: -actualAmount,
          bonusPercent: 0, type: 'consumption'
        })
      }
    })


    // 第二阶段：动态工人消耗（按照规划列表顺序，前面的建筑优先住满）
    let remainingWf = currentWf;
    plannedModules.value.forEach(item => {
      const info = modulesMap.value[item.id]
      // 仅处理带人口容量且还有剩余工人的模块
      if (!info || !info.workforce || info.workforce.capacity <= 0 || remainingWf <= 0) return

      const capacity = info.workforce.capacity * item.count
      const residents = Math.min(remainingWf, capacity)
      remainingWf -= residents

      // 优先匹配模块自带的 race，匹配失败则回退到 default
      const raceKey = info.race in consumptionRaw ? info.race : 'default';
      const raceConsumption = (consumptionRaw as any)[raceKey];
      const wares = raceConsumption.wares || raceConsumption; // 兼容嵌套结构

      for (const [wareId, perPersonPerSecond] of Object.entries(wares)) {
        if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] }
        
        // 公式：居住人数 * 每秒消耗系数 * 3600秒
        const hourlyAmount = residents * (perPersonPerSecond as number) * 3600;
        
        wareDetails[wareId].consumption += hourlyAmount
        wareDetails[wareId].list.push({
          moduleId: item.id,
          nameId: info.nameId,
          count: item.count,
          amount: -hourlyAmount,
          label: `Worker Consumption (${Math.round(residents)} ppl)`,
          type: 'consumption'
        })
      }
    })

    const productionItems: Record<string, { amount: number, value: number }> = {}
    const expenseItems: Record<string, { amount: number, value: number }> = {}
    let totalRevenue = 0, totalExpense = 0

    // 第二阶段：轧差法核心逻辑
    for (const [wareId, data] of Object.entries(wareDetails)) {
      const net = data.production - data.consumption
      if (Math.abs(net) < 0.001) continue
      if (net > 0) {
        // 净产出 > 0: 计入收入
        const price = getDynamicPrice(wareId, false)
        const val = net * price
        productionItems[wareId] = { amount: net, value: val }
        totalRevenue += val
      } else {
        // 净产出 < 0: 计入支出
        const absAmount = Math.abs(net)
        const ware = waresMap.value[wareId]
        const isMined = ware?.transport === 'solid' || ware?.transport === 'liquid'
        
        let price = getDynamicPrice(wareId, true)
        if (settings.value.internalSupply) price = 0
        else if (settings.value.minersEnabled && isMined) price = 0
        
        const val = absAmount * price
        expenseItems[wareId] = { amount: absAmount, value: val }
        totalExpense += val
      }
    }

    return { 
      wareDetails, totalRevenue, totalExpense, profit: totalRevenue - totalExpense,
      production: { total: totalRevenue, items: productionItems },
      expenses: { total: totalExpense, items: expenseItems }
    }
  })
  
  const netProduction = computed(() => {
    const net: Record<string, { total: number, details: any[] }> = {}
    const { wareDetails } = profitBreakdown.value
    
    for (const [wareId, data] of Object.entries(wareDetails)) {
      const diff = data.production - data.consumption
      if (Math.abs(diff) > 0.001) {
        net[wareId] = { total: diff, details: data.list }
      }
    }
    return net
  })

  /**
   * 自动填充缺失生产线：
   * 1. 扫描 netProduction 中所有为负的资源
   * 2. 根据是否考虑工人加成计算所需模块数量
   * 3. 自动加入规划列表
   */
  function autoFillMissingLines() {
    const net = netProduction.value;
    const saturation = efficiencyMetrics.value.saturation;

    Object.entries(net).forEach(([wareId, data]) => {
      if (data.total < -0.001) {
        const deficit = Math.abs(data.total);
        // 寻找产出该资源的第一个模块（排除居住模块本身）
        const targetModule = Object.values(modulesMap.value).find(m => m.outputs[wareId] && m.type !== 'habitat');
        
        if (targetModule) {
          // 计算单模块效率系数
          let eff = 1.0;
          if (settings.value.considerWorkforceForAutoFill) {
            eff = 1.0 + (saturation * (targetModule.workforce?.maxBonus || 0));
          }
          
          const singleModuleOutput = (targetModule.outputs[wareId] || 0) * eff;
          if (singleModuleOutput > 0) {
            const count = Math.ceil(deficit / singleModuleOutput);
            addModule(targetModule.id, count);
          }
        }
      }
    });
  }
  // 物理阻塞初始化，确保顺序
  const initializeStore = async () => {
    isReady.value = false;
    try {
      // 1. 显式等待 Cookie 指定的语言包加载完毕
      await loadLanguageAsync(currentLocale.value);
      
      // 2. 优先从 localStorage 恢复数据，若无则加载 Demo
      const stored = localStorage.getItem('x4_station_data');
      if (stored) {
        try {
          loadData(JSON.parse(stored));
        } catch (e) {
          console.error('[Store] Failed to parse localStorage data, falling back to demo', e);
          loadDemoData();
        }
      } else {
        loadDemoData();
      }
      
      // 3. 此时快照记录的是翻译完备后的数据，脏检查(isDirty)才会准确
      takeSnapshot();
      isReady.value = true;
    } catch (e) {
      console.error('[Store] Initialization failed:', e);
    }
  };

  initializeStore();

  return {
    isReady, isDirty,
    plannedModules, settings, searchQuery, filteredModulesGrouped,
    wares: waresMap, modules: localizedModulesMap, moduleGroups: localizedModuleGroupsMap,
    loadData, loadDemoData, savedLayouts, saveCurrentLayout, loadLayout, mergeLayout, deleteLayout,
    addModule, importPlan, updateModuleId, updateModuleCount, removeModule, removeModuleById, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown, autoFillMissingLines,
    actualWorkforce, currentEfficiency: computed(() => efficiencyMetrics.value.saturation), netProduction
  }
})