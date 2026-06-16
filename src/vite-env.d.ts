/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'culori' {
  export function differenceCiede2000(): (a: any, b: any) => number
  export function parse(color: string): any
}