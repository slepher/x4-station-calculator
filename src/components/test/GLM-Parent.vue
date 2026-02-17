	<script setup>
	import { ref } from 'vue'
	import ListItem from './GLM-Child.vue'
	const items = ref([
	  {
	    id: 1,
	    title: 'Vue 3 Composition API 深入解析与实践指南',
	    resourceTags: ['Vue', 'Frontend'],
	    multiplier: 2.5
	  },
	  {
	    id: 2,
	    title: 'Tailwind CSS 最佳实践',
	    resourceTags: ['CSS'],
	    multiplier: 1.5
	  },
	  {
	    id: 3,
	    title: '这是一个非常非常非常长的标题文字用来测试层级遮罩效果和渐变淡出功能是否正常工作',
	    resourceTags: ['Design', 'UI', 'UX'],
	    multiplier: 3.0
	  },
	  {
	    id: 4,
	    title: 'TypeScript 高级类型编程',
	    resourceTags: ['TS', 'Type'],
	    multiplier: 1.8
	  }
	])
	const handleAdd = (title) => {
	  console.log('Add clicked:', title)
	}
	</script>
	<template>
	  <div class="min-h-screen bg-slate-950 p-8">
	    <div class="max-w-2xl mx-auto space-y-3">
	      <h2 class="text-white text-xl font-semibold mb-6 px-5">
	        Custom List Items
	      </h2>
	      <div class="space-y-2">
	        <ListItem
	          v-for="item in items"
	          :key="item.id"
	          :title="item.title"
	          :resource-tags="item.resourceTags"
	          :multiplier="item.multiplier"
	          @add="handleAdd"
	        />
	      </div>
	    </div>
	  </div>
	</template>