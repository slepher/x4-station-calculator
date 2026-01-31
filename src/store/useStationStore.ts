import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { mockStationData, type SavedModule } from '@/mock/mock_data_v1'
import type { X4Module, X4Ware, WareAmountMap } from '../types/x4'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/useX4I18n'
import { loadLanguageAsync } from '@/i18n'

// 1. 静态导入游戏数据
import waresRaw from '@/assets/game_data/Timelines (7.10)/data/wares.json'
import ModulesRaw from '@/assets/game_data/Timelines (7.10)/data/modules.json'

export interface PlannedModuleDisplay extends SavedModule {
  nameId: string;    
  cost: number;      
  buildCost: WareAmountMap; 
}

export const useStationStore = defineStore('station', () => {
  const { locale: currentLocale } = useI18n();
  const { translateModule } = useX4I18n();
  
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
    const newMap: Record<string, any> = {};

    ModulesRaw.forEach(m => {
      newMap[m.id] = {
        ...m,
        // 如果是 en，直接同步 name 字段，不再进入 translate 查找开销
        localeName: isEn ? (m.name || '') : translateModule(m as any)
      };
    });
    localizedModulesMap.value = newMap;
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

    const results: Record<string, any[]> = {};

    Object.values(localizedModulesMap.value).forEach(m => {
      const localeName = (m.localeName || '').toLowerCase();
      const originalName = (m.name || '').toLowerCase();
      const id = (m.id || '').toLowerCase();

      const localeHit = localeName.includes(query);
      const idHit = id.includes(query);
      const nameHit = !isEn && originalName.includes(query); // 仅在非 EN 模式匹配原始名
      
      const isMatch = !isSearching || (localeHit || nameHit || idHit);

      if (isMatch) {
        let label = m.localeName;
        if (isSearching) {
          // 像素级共识：括号补偿显示逻辑
          if (isEn) {
            if (idHit && !localeHit) label += ` (${m.id})`;
          } else {
            if (nameHit && !localeHit) {
              label += ` (${m.name})`;
            } else if (idHit && !localeHit && !nameHit) {
              label += ` (${m.id})`;
            }
          }
        }
        const type = m.type || 'others';
        if (!results[type]) results[type] = [];
        results[type].push({ ...m, displayLabel: label });
      }
    });
    return results;
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
    const description = [...plannedModules.value]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(m => {
        const info = localizedModulesMap.value[m.id];
        return `${m.count} x ${info?.localeName || m.id}`;
      })
      .join(', ') + (plannedModules.value.length > 3 ? '...' : '');

    const layoutData = {
      id: savedLayouts.value.activeId || crypto.randomUUID(),
      name,
      modules: JSON.parse(JSON.stringify(plannedModules.value)),
      settings: JSON.parse(JSON.stringify(settings.value)),
      description,
      lastUpdated: Date.now()
    };

    const idx = savedLayouts.value.list.findIndex(l => l.id === layoutData.id);
    if (idx !== -1) savedLayouts.value.list[idx] = layoutData;
    else savedLayouts.value.list.push(layoutData);
    savedLayouts.value.activeId = layoutData.id;
    takeSnapshot()
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
        if (!wareDetails[wareId]) wareDetails[wareId] = { production: 0, consumption: 0, list: [] }
        const actualAmount = hourlyAmount * item.count
        wareDetails[wareId].consumption += actualAmount
        wareDetails[wareId].list.push({
          moduleId: item.id, nameId: info.nameId, count: item.count, amount: -actualAmount,
          bonusPercent: 0, type: 'consumption'
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
      
      // 2. 此时翻译字典已就绪，再加载 Demo 数据
      loadDemoData();
      
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
    wares: waresMap, modules: localizedModulesMap,
    loadData, loadDemoData, savedLayouts, saveCurrentLayout, loadLayout, mergeLayout, deleteLayout,
    addModule, updateModuleId, updateModuleCount, removeModule, removeModuleById, clearAll, getModuleInfo,
    constructionBreakdown, workforceBreakdown, profitBreakdown, autoFillMissingLines,
    actualWorkforce, currentEfficiency: computed(() => efficiencyMetrics.value.saturation), netProduction
  }
})