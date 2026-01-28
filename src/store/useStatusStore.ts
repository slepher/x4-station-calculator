import { defineStore } from 'pinia';

export interface StatusMessage {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  category: 'i18n' | 'system' | 'data' | 'save';
  message: string;
  timestamp: number;
}

export const useStatusStore = defineStore('status', {
  state: () => ({
    messages: [] as StatusMessage[],
  }),
  actions: {
    /**
     * 推送一条新消息
     */
    pushMessage(type: StatusMessage['type'], category: StatusMessage['category'], message: string) {
      const id = Date.now();
      this.messages.unshift({ // 新消息放在最上面
        id,
        type,
        category,
        message,
        timestamp: id
      });

      // 如果是成功信息，5秒后自动移除，保持控制台整洁
      if (type === 'success' || type === 'info') {
        setTimeout(() => this.removeMessage(id), 5000);
      }
    },

    removeMessage(id: number) {
      this.messages = this.messages.filter(m => m.id !== id);
    },

    clearAll() {
      this.messages = [];
    }
  }
});