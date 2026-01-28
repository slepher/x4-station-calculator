import { useI18n } from 'vue-i18n';
import type { X4Module, X4Ware } from '../types/x4';
import { useStatusStore } from '../store/useStatusStore';
import { ref } from 'vue';

// 仅修改数据结构：使用 Map 存储 ID 到 NameId 的映射
const missingKeys = ref(new Map<string, string>());

export function useX4I18n() {
  const { t, te } = useI18n();
  const statusStore = useStatusStore();

  const translate = (id: string, nameId: string, category: 'module' | 'ware'): string => {
    if (te(nameId)) {
      return t(nameId);
    }

    // 仅修改记录逻辑：记录 ID 和缺失的 nameId 的对应关系
    if (nameId && !missingKeys.value.has(id)) {
      missingKeys.value.set(id, nameId);
      console.warn(`[i18n Missing] ${category.toUpperCase()} | ID: ${id} | Key: ${nameId}`);
    }

    return `!! ${id} !!`;
  };

  // 仅修改格式变换：显示前 10 行并采用 [ID] -> NameId 格式
  const showMissingDetails = () => {
    if (missingKeys.value.size === 0) return;
    
    const entries = Array.from(missingKeys.value.entries());
    const total = entries.length;
    const rows = entries.slice(0, 10).map(([id, nameId], i) => `${i + 1}. [${id}] -> ${nameId}`);
    
    let content = rows.join('\n');
    if (total > 10) {
      content += `\n\n... 还有 ${total - 10} 条错误 (请查看控制台)`;
    }

    statusStore.pushMessage('warning', 'i18n', `i18n 追踪明细 (${total}):\n\n${content}`);
  };

  return {
    // 严格保留原始 translateModule 定义
    translateModule: (m: X4Module) => {
      return translate(m.id, m.nameId || 'MISSING_NAME_ID', 'module');
    },

    // 严格保留原始 translateWare 定义
    translateWare: (w: X4Ware) => {
      return translate(w.id, w.nameId || 'MISSING_NAME_ID', 'ware');
    },

    translate,
    missingKeys, // 移除多余的 missingCount，组件中直接使用 missingKeys.size
    showMissingDetails
  };
}