import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { mockStationData } from '@/mock/mock_data_v1'
import type {
  X4Module,
  X4Ware,
  X4ModuleGroup,
  X4Workforce,
  SavedModule,
  StationSettings,
  ProductionLogItem,
  WareDetail
} from '../types/x4'
import { useI18n } from 'vue-i18n'
import { useX4I18n } from '@/utils/UseX4I18n'
import { loadLanguageAsync } from '@/i18n'
import { calculateWorkforceBreakdown, calculateActualWorkforce, calculateEfficiencySaturation } from './logic/workforceCalculator'
import { calculateProfitBreakdown, calculateNetProduction, calculateAutoFillSuggestions } from './logic/productionCalculator'

// 1. 静态导入游戏数据
import waresRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/wares.json'
import ModulesRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/modules.json'
import moduleGroupsRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/module_groups.json'
import consumptionRaw from '@/assets/x4_game_data/8.0-Diplomacy/data/consumption.json'
// --- 类型定义 (Type Definitions) ---

export interface StationLayout {
  id: string;
  name: string;
  modules: SavedModule[];
  settings: StationSettings;
  lastUpdated: number;
}

export interface SavedLayoutsState {
  version: number;
  activeId: string | null;
  list: StationLayout[];
}

export interface PlannedModuleDisplay extends SavedModule {
  nameId: string;    
  cost: number;      
  buildCost: Record<string, number>; 
}

export type LocalizedX4Module = X4Module & { localeName: string };
export type LocalizedX4ModuleGroup = X4ModuleGroup & { localeName: string };

export interface GroupedModuleItem extends LocalizedX4Module {
  displayLabel: string;
  moduleGroup?: LocalizedX4ModuleGroup;
}

export interface ModuleGroupResult {
  group: string;
  displayLabel: string;
  modules: GroupedModuleItem[];
}

export const useStationStore = defineStore('station', () => {
  const { locale: currentLocale } = useI18n();
  const { translateModule, translateModuleGroup } = useX4I18n();
  
  // --- 状态 (State) ---
  const isReady = ref(false)
  const plannedModules = ref<SavedModule[]>([])
  const savedLayouts = ref<SavedLayoutsState>({ version: 1, activeId: null, list: [] });
  const searchQuery = ref('') // 全局搜索状态，驱动检索逻辑
  const localizedModulesMap = ref<Record<string, LocalizedX4Module>>({});
  const localizedModuleGroupsMap = ref<Record<string, LocalizedX4ModuleGroup>>({});

  // --- 脏检查快照 (Dirty Check) ---
  // 存储最后一次保存或加载时的 JSON 字符串，用于物理级对比
  const lastSavedSnapshot = ref<string>('')

  const settings = ref<StationSettings>({
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
        } as X4Workforce
      } as X4Module
    })
    return map
  })

  // --- 数据预热 (针对 EN 模式优化：不执行重复翻译计算) ---
  const prepareLocalizedData = () => {
    const isEn = currentLocale.value === 'en';
    const newModuleMap: Record<string, LocalizedX4Module> = {};

    ModulesRaw.forEach(m => {
      newModuleMap[m.id] = {
        ...(m as unknown as X4Module),
        // 如果是 en，直接同步 name 字段，不再进入 translate 查找开销
        localeName: isEn ? (m.name || '') : translateModule(m as any)
      };
    });
    localizedModulesMap.value = newModuleMap;

    const newModuleGroupsMap: Record<string, LocalizedX4ModuleGroup> = {};
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
    const filteredModulesGrouped = computed<ModuleGroupResult[]>(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const isSearching = query.length > 0;
    const isEn = currentLocale.value === 'en';

    const groups: Record<string, GroupedModuleItem[]> = {};
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
        groups[type].push({ 
          ...m, 
          displayLabel: label, 
          moduleGroup: localizedModuleGroupsMap.value[m.group] 
        });
      }
    });
const TYPE_PRIORITY: Record<string, number> = {
    production: 1,
    processingmodule: 2,
    habitation: 3,
    storage: 4
  };

  // 新增：针对生产类目下的子组排序优先级
  const GROUP_PRIORITY: Record<string, number> = {
    shiptech: 1, // 飞船商品
    hightech: 2, // 高科技商品
    refined: 3,  // 精炼商品
    energy: 4    // 太阳能/能量
  };

  return Object.keys(groups)
    .sort((a, b) => {
      const typeA = localizedModuleGroupsMap.value[a]?.type || a;
      const typeB = localizedModuleGroupsMap.value[b]?.type || b;

      // 1. 第一级排序：按 Type 优先级 (生产 > 居住 > 存储)
      const pTypeA = TYPE_PRIORITY[typeA] || 99;
      const pTypeB = TYPE_PRIORITY[typeB] || 99;
      if (pTypeA !== pTypeB) return pTypeA - pTypeB;

      // 2. 第二级排序：按特定的 Group ID 优先级
      const pGroupA = GROUP_PRIORITY[a] || 99;
      const pGroupB = GROUP_PRIORITY[b] || 99;
      if (pGroupA !== pGroupB) return pGroupA - pGroupB;

      // 3. 第三级排序：默认字母序
      return a.localeCompare(b);
    })
    .map(group => ({
      group,
      displayLabel: typeMetadata[group]?.displayLabel || group,
      modules: groups[group] || []
    }));
  });
  
  // --- 操作方法 (Actions) ---
  function loadData(source: SavedLayoutsState) {

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
    loadData(mockStationData as unknown as SavedLayoutsState);
  }

  function saveCurrentLayout(name: string) {
    const layoutData: StationLayout = {
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
      const plannedModule = plannedModules.value[index];
      if(plannedModule) plannedModule.id = newId;
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
      let match: RegExpExecArray | null; // 显式类型标注
      const counts: Record<string, number> = {};
      let totalFound = 0;
      while ((match = matchMacro.exec(raw)) !== null) {
        const macro = match[1];
        if(!macro) continue;
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
      
      // 使用可选链解构，防止 exec 返回 null
      const idMatch = /\$module-([^,]+)/.exec(part);
      const countMatch = /count:(\d+)/.exec(part);
      
      if (idMatch && idMatch[1]) {
        let id = idMatch[1];
        const count = (countMatch && countMatch[1]) ? parseInt(countMatch[1], 10) : 1;
        
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
      id, wareId: '', nameId: id, type: 'unknown', group: 'others', race: 'unknown', buildTime: 0,
      buildCost: {}, cycleTime: 0, outputs: {}, inputs: {},
      workforce: { capacity: 0, needed: 0, maxBonus: 0 }
    } as X4Module
  }

  // --- 业务计算逻辑 (接口完整性保障) ---

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

  const workforceBreakdown = computed(() => 
    calculateWorkforceBreakdown(plannedModules.value, modulesMap.value, settings.value)
  )

  const actualWorkforce = computed(() => 
    calculateActualWorkforce(workforceBreakdown.value, settings.value)
  )

  const efficiencyMetrics = computed(() => ({
    saturation: calculateEfficiencySaturation(workforceBreakdown.value.needed.total, actualWorkforce.value)
  }))
  
  const profitBreakdown = computed(() => {
    return calculateProfitBreakdown(
      plannedModules.value,
      modulesMap.value,
      waresMap.value,
      settings.value,
      actualWorkforce.value,
      efficiencyMetrics.value.saturation
    )
  })
  
  const netProduction = computed(() => 
    calculateNetProduction(profitBreakdown.value.wareDetails)
  )

  /**
   * 自动填充缺失生产线：
   * 1. 扫描 netProduction 中所有为负的资源
   * 2. 根据是否考虑工人加成计算所需模块数量
   * 3. 自动加入规划列表
   */
  function autoFillMissingLines() {
    const suggestions = calculateAutoFillSuggestions(
      netProduction.value,
      modulesMap.value,
      settings.value,
      efficiencyMetrics.value.saturation
    );
    suggestions.forEach(suggestion => {
      addModule(suggestion.moduleId, suggestion.count);
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