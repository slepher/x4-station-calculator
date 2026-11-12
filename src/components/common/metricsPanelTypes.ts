export type MetricsOrder = 'row' | 'column'

export type MetricValueMap = Record<string, number | undefined>

export type MetricSchemaItem = {
  key: string
  labelKey: string
  unit?: string
  max?: number
  lowerIsBetter?: boolean
  hideBar?: boolean
  hint?: string
}

export type MetricSchema = MetricSchemaItem[][]

export type MetricsPanelView = {
  mode: string
  label: string
  keys: string[] | 'all'
}

export type MetricsPanelViewTab = {
  views: MetricsPanelView[]
  style?: 'sky' | 'emerald' | 'amber'
}
