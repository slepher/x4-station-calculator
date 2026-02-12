# Test Experience & Locator Knowledge Base

## 🌲 树形形态记录 (DOM Tree & Locators)

### FavoriteButton & LockButton Tooltip
*   **Logical Object**: Tooltip for Favorite/Lock buttons
*   **Locator**: `.tippy-box[data-theme~="x4"]`
*   **Valid Path**: 
    *   Row Container: `.priority-tooltip-row` (✅)
    *   Grid Columns: `.icon-cell`, `.label-cell`, `.hours-cell`, `.desc-cell` (✅)
*   **Specific Data**:
    *   Layout: `display: grid`
    *   Filtering: "Planned" resources show 2 rows, "Pure Consumption" shows 1 row.

### Resource Flow List
*   **Logical Object**: Row in the Ware Flow list
*   **Locator**: `.list-body .group-container .flow-wrapper` (✅)
*   **Specific Data**: First item is often 'Energy Cells' if a Solar Power Plant is added.

## 🕳️ 历史定位大坑 (Pitfalls)

*   **Timeout waiting for store**: E2E tests wait for `window.store` but `main.ts` didn't expose it. Fixed by adding explicit exposure in [App.vue](file:///d:/Documents/project/x4-station-calculator/src/App.vue) when `isTestEnv` is true. (✅)
*   **Production vs Dev Env**: `import.meta.env.DEV` is false in `npm run preview`. Tests must use `isTestEnv` flag injected via `addInitScript`. (✅)
*   **Tooltip Persistence**: Tippy tooltips with `hideOnClick: false` still require manual mouse move to verify hiding behavior in tests. (✅)
*   **Vite Preview Base Path**: The preview server might use a base path like `/x4-station-calculator/`. `playwright.config.ts` must match this exactly in `baseURL` and `webServer.url`. (✅)
*   **TypeScript Errors in Tests**: Playwright might try to compile `.spec.ts` files that are actually unit tests for `vitest`. Ensure `testDir` or file filters are used to separate them. (✅)
