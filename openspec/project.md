# X4 Station Calculator - Project Context

## Project Overview
X4 Station Calculator is a Vue 3 + TypeScript + Vite web application for calculating and optimizing space station layouts in the X4: Foundations game. The application provides comprehensive tools for planning station production, resource management, workforce optimization, and profitability analysis.

## Technology Stack
- **Framework**: Vue 3 with Composition API and `<script setup>` syntax
- **Language**: TypeScript
- **Build Tool**: Vite
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Internationalization**: Vue I18n with JSON-based translations
- **Storage**: js-cookie for persistent settings
- **Drag & Drop**: vuedraggable for module reordering

## Project Structure

```
src/
├── assets/
│   └── x4_game_data/
│       └── 8.0-Diplomacy/
│           ├── data/
│           │   ├── consumption.json
│           │   ├── languages.json
│           │   ├── module_groups.json
│           │   ├── modules.json
│           │   └── wares.json
│           └── locales/
│               ├── de.json
│               ├── en.json
│               ├── es.json
│               ├── fr.json
│               ├── it.json
│               ├── ja.json
│               ├── ko.json
│               ├── pl.json
│               ├── pt-BR.json
│               ├── ru.json
│               ├── zh-CN.json
│               └── zh-TW.json
├── components/
│   ├── common/
│   │   └── X4NumberInput.vue
│   ├── ImportPlanModal.vue
│   ├── LanguageSelector.vue
│   ├── LoadLayoutModal.vue
│   ├── MissingTranslate.vue
│   ├── PriceSlider.vue
│   ├── ResourceItem.vue
│   ├── ResourceList.vue
│   ├── SmartSaveDialog.vue
│   ├── StationConstruction.vue
│   ├── StationModuleItem.vue
│   ├── StationModuleList.vue
│   ├── StationModuleSelector.vue
│   ├── StationPlanner.vue
│   ├── StationToolbar.vue
│   ├── StationProfit.vue
│   ├── StationWorkforce.vue
│   └── StatusMonitor.vue
├── locales/
│   ├── en.json
│   └── zh-CN.json
├── mock/
│   └── mock_data_v1.ts
├── store/
│   ├── logic/
│   │   ├── bestModuleSelector.ts
│   │   ├── blueprintParser.ts
│   │   ├── moduleDiffCalculator.ts
│   │   ├── productionCalculator.ts
│   │   ├── searchModule.ts
│   │   ├── useGameData.ts
│   │   ├── workerModuleCalculator.ts
│   │   └── workforceCalculator.ts
│   ├── useStationStore.ts
│   └── useStatusStore.ts
├── types/
│   └── x4.ts
├── utils/
│   └── UseX4I18n.ts
├── App.vue
├── i18n.ts
├── main.ts
├── style.css
└── vite-env.d.ts
```

## Key Features

### Core Functionality
- **Station Planning**: Add, remove, and reorder production modules
- **Resource Management**: Track production and consumption of all resources
- **Workforce Optimization**: Calculate optimal workforce requirements and bonuses
- **Profit Analysis**: Simulate station profitability with customizable price multipliers
- **Construction Planning**: Estimate build time and resource requirements

### Advanced Features
- **Blueprint Import**: Import station layouts from XML blueprints
- **Layout Management**: Save and load multiple station layouts
- **Auto-fill**: Automatically balance production modules
- **Search & Filter**: Find modules by name, type, or race
- **Multi-language Support**: UI available in 12 languages

## Data Model

### Core Entities
- **X4Module**: Production, habitation, storage, and dock modules
- **X4Ware**: Game resources and commodities
- **X4Workforce**: Labor requirements and bonuses
- **StationLayout**: Complete station configuration with modules and settings

### Store Structure
The application uses Pinia for state management with two main stores:
- **useStationStore**: Manages station data, modules, calculations, and layouts
- **useStatusStore**: Handles application status and notifications

## Styling System
- **Framework**: Tailwind CSS with custom utility classes
- **Color Scheme**: Dark theme with slate/amber color palette
- **Responsive Design**: Grid-based layout with mobile optimization
- **Custom Components**: Styled form controls and interactive elements

## Internationalization
- **Framework**: Vue I18n with JSON-based message files
- **Languages**: 12 supported languages including English, Chinese, German, etc.
- **Game Data**: Localized module names and descriptions from X4 game data
- **Persistent Settings**: Language preference stored in cookies

## Build Configuration

### Dependencies
```json
{
  "vue": "^3.5.24",
  "typescript": "~5.9.3",
  "vite": "^7.3.1",
  "pinia": "^3.0.4",
  "vue-i18n": "^11.2.8",
  "tailwindcss": "^3.4.19",
  "js-cookie": "^3.0.5",
  "vuedraggable": "^4.1.0"
}
```

### Development Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Game Data Integration

The application integrates with X4: Foundations game data including:
- Module specifications (production rates, workforce requirements)
- Resource definitions (prices, transport types)
- Localization data for all supported languages
- Construction requirements and build times

## Deployment
- **GitHub Pages**: Configured for deployment to GitHub Pages
- **Base Path**: `/x4-station-calculator/` for repository-based deployment
- **Build Process**: TypeScript compilation + Vite bundling

## Development Notes
- Uses Vue 3 Composition API with TypeScript strict mode
- Implements custom calculation logic for X4 game mechanics
- Supports both manual and automated workforce management
- Includes comprehensive error handling and user feedback
- Optimized for performance with computed properties and reactive updates

## Current Status
Application is fully functional with comprehensive station planning capabilities. The codebase is well-structured with clear separation of concerns between UI components, business logic, and data management.