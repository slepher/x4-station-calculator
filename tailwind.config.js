/** @type {import('tailwindcss').Config} */
export default {
  // 必须包含 index.html 和 src 下的所有 vue/js/ts 文件
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}