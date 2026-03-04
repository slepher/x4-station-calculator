import type {
  MetricSchema,
  MetricsOrder,
  MetricsPanelViewTab,
  MetricValueMap
} from '@/components/common/metricsPanelTypes'

export type MetricPanelCase = {
  id: string
  title: string
  description: string
  schema: MetricSchema
  objCurrent: MetricValueMap | null
  objTarget: MetricValueMap | null
  order: MetricsOrder
  viewTab: MetricsPanelViewTab | null
  expected: string[]
}

const engineSchema: MetricSchema = [
  [
    { key: 'speed', labelKey: 'Speed', unit: 'm/s', max: 400 },
    { key: 'acceleration', labelKey: 'Acceleration', unit: 'm/s2', max: 40 },
    { key: 'boostSpeed', labelKey: 'Boost Speed', unit: 'm/s', max: 1200 }
  ],
  [
    { key: 'travelSpeed', labelKey: 'Travel Speed', unit: 'm/s', max: 6000 },
    { key: 'travelCharge', labelKey: 'Travel Charge', unit: 's', max: 15 },
    { key: 'yawRate', labelKey: 'Yaw Rate', unit: 'rad/s', max: 2 }
  ]
]

const currentValues: MetricValueMap = {
  speed: 180,
  acceleration: 12,
  boostSpeed: 580,
  travelSpeed: 2600,
  travelCharge: 8,
  yawRate: 0.72
}

const targetValues: MetricValueMap = {
  speed: 205,
  acceleration: 10,
  boostSpeed: 620,
  travelSpeed: 3100,
  travelCharge: 6,
  yawRate: 0.68
}

const tabConfig: MetricsPanelViewTab = {
  style: 'emerald',
  views: [
    { mode: 'combat', label: 'Combat', keys: ['speed', 'acceleration', 'boostSpeed'] },
    { mode: 'travel', label: 'Travel', keys: ['travelSpeed', 'travelCharge'] },
    { mode: 'maneuver', label: 'Maneuver', keys: ['yawRate'] },
    { mode: 'all', label: 'All', keys: 'all' }
  ]
}

export const metricPanelCases: MetricPanelCase[] = [
  {
    id: 'basic-row',
    title: 'Row Order / No Tab',
    description: '基线场景：row 展开，无 viewTab。',
    schema: engineSchema,
    objCurrent: currentValues,
    objTarget: targetValues,
    order: 'row',
    viewTab: null,
    expected: ['渲染 6 个指标', '顺序按 row-major']
  },
  {
    id: 'column-order',
    title: 'Column Order / No Tab',
    description: '列优先展开顺序验证。',
    schema: engineSchema,
    objCurrent: currentValues,
    objTarget: targetValues,
    order: 'column',
    viewTab: null,
    expected: ['渲染 6 个指标', '顺序按 column-major']
  },
  {
    id: 'view-filter',
    title: 'ViewTab Filter',
    description: '切换 mode 时仅显示该 mode 的 keys。',
    schema: engineSchema,
    objCurrent: currentValues,
    objTarget: targetValues,
    order: 'row',
    viewTab: tabConfig,
    expected: ['combat 仅 3 项', 'travel 仅 2 项', 'maneuver 仅 1 项']
  },
  {
    id: 'view-all',
    title: 'ViewTab All Keys',
    description: 'mode keys=all 时不隐藏任何指标。',
    schema: engineSchema,
    objCurrent: currentValues,
    objTarget: targetValues,
    order: 'column',
    viewTab: tabConfig,
    expected: ['切到 all 显示全部 6 项']
  },
  {
    id: 'target-only',
    title: 'Target Only',
    description: 'objCurrent=null，仅显示 target 值。',
    schema: engineSchema,
    objCurrent: null,
    objTarget: targetValues,
    order: 'row',
    viewTab: null,
    expected: ['无 diff', '显示 target 数值']
  },
  {
    id: 'current-only',
    title: 'Current Only',
    description: 'objTarget=null，仅显示 current 值。',
    schema: engineSchema,
    objCurrent: currentValues,
    objTarget: null,
    order: 'row',
    viewTab: null,
    expected: ['无 diff', '显示 current 数值']
  },
  {
    id: 'ragged-schema',
    title: 'Ragged Schema',
    description: '不规则二维 schema（各行列数不一致）',
    schema: [
      [
        { key: 'speed', labelKey: 'Speed', unit: 'm/s', max: 400 },
        { key: 'travelSpeed', labelKey: 'Travel Speed', unit: 'm/s', max: 6000 }
      ],
      [{ key: 'yawRate', labelKey: 'Yaw Rate', unit: 'rad/s', max: 2 }],
      [
        { key: 'acceleration', labelKey: 'Acceleration', unit: 'm/s2', max: 40 },
        { key: 'travelCharge', labelKey: 'Travel Charge', unit: 's', max: 15 },
        { key: 'boostSpeed', labelKey: 'Boost Speed', unit: 'm/s', max: 1200 }
      ]
    ],
    objCurrent: currentValues,
    objTarget: targetValues,
    order: 'column',
    viewTab: null,
    expected: ['应跳过空洞格', '不报错并完整渲染已有 key']
  }
]
