import type {
  ResolvedXYAxisRenderConfig,
  ResolvedXYChartConfig,
  XYAxisRenderConfig,
  XYChartConfig,
} from './types'

export const DEFAULT_XY_AXIS_CONFIG: ResolvedXYAxisRenderConfig = {
  axisLineWidth: 2,
  labelFontSize: 14,
  labelPadding: 5,
  showAxisLine: true,
  showLabel: true,
  showTick: true,
  showTitle: true,
  tickLength: 5,
  tickWidth: 2,
  titleFontSize: 16,
  titlePadding: 5,
}

export const DEFAULT_XY_CHART_CONFIG: ResolvedXYChartConfig = {
  chartOrientation: 'vertical',
  height: 500,
  plotReservedSpacePercent: 50,
  showDataLabel: false,
  showTitle: true,
  titleFontSize: 20,
  titlePadding: 10,
  useMaxWidth: true,
  useWidth: undefined,
  width: 700,
  xAxis: { ...DEFAULT_XY_AXIS_CONFIG },
  yAxis: { ...DEFAULT_XY_AXIS_CONFIG },
}

export function resolveXYAxisRenderConfig(config?: XYAxisRenderConfig): ResolvedXYAxisRenderConfig {
  return {
    axisLineWidth: getPositiveNumber(config?.axisLineWidth, DEFAULT_XY_AXIS_CONFIG.axisLineWidth),
    labelFontSize: getPositiveNumber(config?.labelFontSize, DEFAULT_XY_AXIS_CONFIG.labelFontSize),
    labelPadding: getNonNegativeNumber(config?.labelPadding, DEFAULT_XY_AXIS_CONFIG.labelPadding),
    showAxisLine: config?.showAxisLine ?? DEFAULT_XY_AXIS_CONFIG.showAxisLine,
    showLabel: config?.showLabel ?? DEFAULT_XY_AXIS_CONFIG.showLabel,
    showTick: config?.showTick ?? DEFAULT_XY_AXIS_CONFIG.showTick,
    showTitle: config?.showTitle ?? DEFAULT_XY_AXIS_CONFIG.showTitle,
    tickLength: getNonNegativeNumber(config?.tickLength, DEFAULT_XY_AXIS_CONFIG.tickLength),
    tickWidth: getPositiveNumber(config?.tickWidth, DEFAULT_XY_AXIS_CONFIG.tickWidth),
    titleFontSize: getPositiveNumber(config?.titleFontSize, DEFAULT_XY_AXIS_CONFIG.titleFontSize),
    titlePadding: getNonNegativeNumber(config?.titlePadding, DEFAULT_XY_AXIS_CONFIG.titlePadding),
  }
}

export function resolveXYChartRenderConfig(config: XYChartConfig): ResolvedXYChartConfig {
  return {
    chartOrientation: config.chartOrientation ?? DEFAULT_XY_CHART_CONFIG.chartOrientation,
    height: getPositiveNumber(config.height, DEFAULT_XY_CHART_CONFIG.height),
    plotReservedSpacePercent: clamp(
      getPositiveNumber(config.plotReservedSpacePercent, DEFAULT_XY_CHART_CONFIG.plotReservedSpacePercent),
      10,
      100,
    ),
    showDataLabel: config.showDataLabel ?? DEFAULT_XY_CHART_CONFIG.showDataLabel,
    showTitle: config.showTitle ?? DEFAULT_XY_CHART_CONFIG.showTitle,
    titleFontSize: getPositiveNumber(config.titleFontSize, DEFAULT_XY_CHART_CONFIG.titleFontSize),
    titlePadding: getNonNegativeNumber(config.titlePadding, DEFAULT_XY_CHART_CONFIG.titlePadding),
    useMaxWidth: config.useMaxWidth ?? DEFAULT_XY_CHART_CONFIG.useMaxWidth,
    useWidth: getOptionalPositiveNumber(config.useWidth),
    width: getPositiveNumber(config.width, DEFAULT_XY_CHART_CONFIG.width),
    xAxis: resolveXYAxisRenderConfig(config.xAxis),
    yAxis: resolveXYAxisRenderConfig(config.yAxis),
  }
}

function getPositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function getNonNegativeNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function getOptionalPositiveNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
