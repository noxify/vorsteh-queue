import type { DiagramColors } from '../theme'
import type { MermaidFrontmatterMap, MermaidConfigValue } from '../mermaid-source'
import type { RenderOptions } from '../types'
import { resolveRenderStyle } from '../styles'
import type { RenderStyleDefaults } from '../styles'

export interface ArchitectureVisualConfig {
  groupHeaderHeight: number
  groupFontSize: number
  groupFontWeight: number
  groupLetterSpacing: number
  groupFont?: string
  groupTextTransform?: 'uppercase' | 'lowercase' | 'capitalize'
  groupPaddingX: number
  groupPaddingY: number
  groupLabelPaddingX: number
  groupCornerRadius: number
  groupLineWidth: number
  serviceFontSize: number
  serviceFontWeight: number
  serviceLetterSpacing: number
  servicePaddingX: number
  servicePaddingY: number
  serviceCornerRadius: number
  serviceLineWidth: number
  edgeFontSize: number
  edgeFontWeight: number
  edgeLetterSpacing: number
  edgeLineWidth: number
  edgeBendRadius: number
  iconSize: number
  serviceIconSize: number
  junctionOuterRadius: number
  junctionInnerRadius: number
  groupSurface?: string
  groupBorder?: string
  serviceSurface?: string
  serviceBorder?: string
}

export interface ResolvedArchitectureVisualConfig {
  visual: ArchitectureVisualConfig
  padding?: number
}

export const DEFAULT_ARCHITECTURE_VISUAL: ArchitectureVisualConfig = {
  edgeBendRadius: 0,
  edgeFontSize: 11,
  edgeFontWeight: 400,
  edgeLetterSpacing: 0,
  edgeLineWidth: 1,
  groupCornerRadius: 0,
  groupFontSize: 12,
  groupFontWeight: 600,
  groupHeaderHeight: 28,
  groupLabelPaddingX: 12,
  groupLetterSpacing: 0,
  groupLineWidth: 1,
  groupPaddingX: 16,
  groupPaddingY: 16,
  iconSize: 16,
  junctionInnerRadius: 4.5,
  junctionOuterRadius: 8,
  serviceCornerRadius: 0,
  serviceFontSize: 13,
  serviceFontWeight: 500,
  serviceIconSize: 18,
  serviceLetterSpacing: 0,
  serviceLineWidth: 1,
  servicePaddingX: 20,
  servicePaddingY: 10,
}

/**
 * Resolve architecture-specific visual metrics from Mermaid frontmatter.
 *
 * Color resolution is handled by the shared `buildColors()` in src/index.ts.
 * This function only computes layout metrics (font sizes, icon sizes, junction
 * radii) and architecture-specific surface/border overrides (clusterBkg, etc.).
 */
export function resolveArchitectureVisualConfig(
  mermaidConfig: MermaidFrontmatterMap,
  colors: DiagramColors,
  options: RenderOptions = {},
): ResolvedArchitectureVisualConfig {
  const themeVariables = getMap(mermaidConfig, 'themeVariables')
  const architecture = getMap(mermaidConfig, 'architecture')

  const baseFontSize = clamp(
    getNumber(architecture, 'fontSize')
      ?? getNumber(mermaidConfig, 'fontSize')
      ?? getNumber(themeVariables, 'fontSize')
      ?? DEFAULT_ARCHITECTURE_VISUAL.serviceFontSize,
    10,
    24,
  )

  const serviceIconSize = clamp(
    getNumber(architecture, 'iconSize') ?? DEFAULT_ARCHITECTURE_VISUAL.serviceIconSize,
    12,
    40,
  )

  const iconSize = clamp(Math.round(serviceIconSize * (DEFAULT_ARCHITECTURE_VISUAL.iconSize / DEFAULT_ARCHITECTURE_VISUAL.serviceIconSize)), 10, 36)
  const groupFontSize = clamp(Math.round(baseFontSize * 0.92), 10, 22)
  const edgeFontSize = clamp(Math.round(baseFontSize * 0.85), 10, 20)
  const groupHeaderHeight = Math.max(
    DEFAULT_ARCHITECTURE_VISUAL.groupHeaderHeight,
    Math.round(Math.max(groupFontSize, iconSize) + 12),
  )
  const junctionOuterRadius = clamp(Math.round(serviceIconSize * 0.44), 8, 18)
  const junctionInnerRadius = Number((junctionOuterRadius * 0.56).toFixed(1))

  const styleDefaults: RenderStyleDefaults = {
    edgeBendRadius: DEFAULT_ARCHITECTURE_VISUAL.edgeBendRadius,
    edgeLabelFontSize: edgeFontSize,
    edgeLabelFontWeight: DEFAULT_ARCHITECTURE_VISUAL.edgeFontWeight,
    edgeLineWidth: DEFAULT_ARCHITECTURE_VISUAL.edgeLineWidth,
    groupCornerRadius: DEFAULT_ARCHITECTURE_VISUAL.groupCornerRadius,
    groupHeaderFontSize: groupFontSize,
    groupHeaderFontWeight: DEFAULT_ARCHITECTURE_VISUAL.groupFontWeight,
    groupLabelPaddingX: DEFAULT_ARCHITECTURE_VISUAL.groupLabelPaddingX,
    groupLineWidth: DEFAULT_ARCHITECTURE_VISUAL.groupLineWidth,
    groupPaddingX: DEFAULT_ARCHITECTURE_VISUAL.groupPaddingX,
    groupPaddingY: DEFAULT_ARCHITECTURE_VISUAL.groupPaddingY,
    nodeCornerRadius: DEFAULT_ARCHITECTURE_VISUAL.serviceCornerRadius,
    nodeLabelFontSize: baseFontSize,
    nodeLabelFontWeight: DEFAULT_ARCHITECTURE_VISUAL.serviceFontWeight,
    nodeLineWidth: DEFAULT_ARCHITECTURE_VISUAL.serviceLineWidth,
    nodePaddingX: DEFAULT_ARCHITECTURE_VISUAL.servicePaddingX,
    nodePaddingY: DEFAULT_ARCHITECTURE_VISUAL.servicePaddingY,
  }
  const style = resolveRenderStyle(options, styleDefaults)

  const visual: ArchitectureVisualConfig = {
    edgeBendRadius: style.edgeBendRadius,
    edgeFontSize: style.edgeLabelFontSize,
    edgeFontWeight: style.edgeLabelFontWeight,
    edgeLetterSpacing: style.edgeLetterSpacing,
    edgeLineWidth: style.lineWidth,
    groupBorder: style.groupBorderColor ?? pickString(themeVariables, 'clusterBorder') ?? colors.border,
    groupCornerRadius: style.groupCornerRadius,
    groupFont: style.groupFont,
    groupFontSize: style.groupHeaderFontSize,
    groupFontWeight: style.groupHeaderFontWeight,
    groupHeaderHeight: Math.max(groupHeaderHeight, style.groupHeaderFontSize + 12),
    groupLabelPaddingX: style.groupLabelPaddingX,
    groupLetterSpacing: style.groupLetterSpacing,
    groupLineWidth: style.groupLineWidth,
    groupPaddingX: style.groupPaddingX,
    groupPaddingY: style.groupPaddingY,
    groupSurface: pickString(themeVariables, 'clusterBkg') ?? colors.surface,
    groupTextTransform: style.groupTextTransform,
    iconSize,
    junctionInnerRadius,
    junctionOuterRadius,
    serviceBorder: pickString(themeVariables, 'primaryBorderColor') ?? colors.border,
    serviceCornerRadius: style.cornerRadius ?? 0,
    serviceFontSize: style.nodeLabelFontSize,
    serviceFontWeight: style.nodeLabelFontWeight,
    serviceIconSize,
    serviceLetterSpacing: style.nodeLetterSpacing,
    serviceLineWidth: style.nodeLineWidth,
    servicePaddingX: style.nodePaddingX,
    servicePaddingY: style.nodePaddingY,
    serviceSurface: pickString(themeVariables, 'mainBkg', 'secondaryColor') ?? colors.surface,
  }

  return { padding: getNumber(architecture, 'padding'), visual }
}

function pickString(map: MermaidFrontmatterMap | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(map, key)
    if (value) {return value}
  }
  return undefined
}

function getString(map: MermaidFrontmatterMap | undefined, key: string): string | undefined {
  const value = map?.[key]
  return typeof value === 'string' ? value : undefined
}

function getNumber(map: MermaidFrontmatterMap | undefined, key: string): number | undefined {
  return toNumber(map?.[key])
}

function getMap(map: MermaidFrontmatterMap | undefined, key: string): MermaidFrontmatterMap | undefined {
  const value = map?.[key]
  return isMap(value) ? value : undefined
}

function toNumber(value: MermaidConfigValue | undefined): number | undefined {
  if (typeof value === 'number') {return value}
  if (typeof value !== 'string') {return undefined}

  const normalized = value.trim()
  const match = normalized.match(/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/i)
  return match ? Number.parseFloat(normalized) : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isMap(value: MermaidConfigValue | undefined): value is MermaidFrontmatterMap {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
