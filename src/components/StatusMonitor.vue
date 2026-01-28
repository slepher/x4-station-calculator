<template>
  <div v-if="statusStore.messages.length > 0" 
       class="fixed bottom-6 right-6 z-[9999] w-85 flex flex-col gap-3 pointer-events-none">
    
    <TransitionGroup name="status-list">
      <div v-for="msg in statusStore.messages" :key="msg.id"
           :class="[
             'pointer-events-auto p-4 rounded-xl border-l-4 shadow-2xl backdrop-blur-md flex flex-col gap-2 transition-all duration-300',
             typeStyles[msg.type]
           ]">
        
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span :class="['text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-black/20', categoryTextStyles[msg.type]]">
              {{ msg.category }}
            </span>
            <span v-if="msg.type === 'error'" class="flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
          <button @click="statusStore.removeMessage(msg.id)" 
                  class="text-lg leading-none opacity-50 hover:opacity-100 transition-opacity">
            &times;
          </button>
        </div>

        <div class="text-xs font-mono break-all leading-relaxed whitespace-pre-wrap">
          {{ msg.message }}
        </div>

        <div class="flex justify-end mt-1">
          <span class="text-[9px] opacity-40 italic">
            {{ formatTime(msg.timestamp) }}
          </span>
        </div>
      </div>
    </TransitionGroup>

    <button v-if="statusStore.messages.length > 3" 
            @click="statusStore.clearAll"
            class="pointer-events-auto self-end text-[10px] font-bold tracking-tighter bg-slate-800/80 text-slate-400 px-3 py-1.5 rounded-full hover:bg-slate-700 hover:text-white transition-all shadow-lg border border-slate-700">
      CLEAR ALL NOTIFICATIONS
    </button>
  </div>
</template>

<script setup lang="ts">
import { useStatusStore } from '@/store/useStatusStore';

const statusStore = useStatusStore();

/**
 * 不同消息类型的样式映射
 */
const typeStyles = {
  success: 'bg-emerald-900/90 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/20',
  error: 'bg-red-950/90 border-red-500 text-red-100 ring-1 ring-red-500/20',
  warning: 'bg-amber-950/90 border-amber-500 text-amber-100 ring-1 ring-amber-500/20',
  info: 'bg-slate-900/90 border-slate-500 text-slate-100 ring-1 ring-slate-500/20'
};

const categoryTextStyles = {
  success: 'text-emerald-300',
  error: 'text-red-300',
  warning: 'text-amber-300',
  info: 'text-slate-300'
};

const formatTime = (ts: number) => {
  return new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
</script>

<style scoped>
/* 列表过渡动画：新消息滑入，旧消息缩放消失 */
.status-list-enter-active, 
.status-list-leave-active { 
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
}

.status-list-enter-from { 
  opacity: 0; 
  transform: translateX(50px) scale(0.9); 
}

.status-list-leave-to { 
  opacity: 0; 
  transform: scale(0.8) translateY(-20px); 
}

/* 列表移动动画（其他元素平滑位移） */
.status-list-move {
  transition: transform 0.3s ease;
}

/* 针对长信息的滚动条美化 */
::-webkit-scrollbar {
  width: 3px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
</style>