/**
 * ER diagram layout engine (ELK.js).
 *
 * Each entity box has:
 *   1. Header (entity name)
 *   2. Attribute rows (type, name, keys)
 */

import type { ElkNode, ElkExtendedEdge } from 'elkjs'
import type { ErDiagram, ErEntity, PositionedErDiagram, PositionedErEntity, PositionedErRelationship } from './types'
import type { RenderOptions, Point } from '../types'
import { estimateTextWidth, estimateMonoTextWidth, FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, resolveRenderStyle } from '../styles'
import type { RenderStyleDefaults } from '../styles'
import { measureMultilineText } from '../text-metrics'
import { elkLayoutSync } from '../elk-instance'

/** Layout constants for ER diagrams */
const ER = {
  attrFontSize: 11,
  attrFontWeight: 400,
  boxPadX: 14,
  headerHeight: 34,
  layerSpacing: 90,
  minWidth: 140,
  nodeSpacing: 70,
  padding: 40,
  rowHeight: 22,
} as const

const ER_STYLE_DEFAULTS: RenderStyleDefaults = {
  edgeLabelFontSize: FONT_SIZES.edgeLabel,
  edgeLabelFontWeight: FONT_WEIGHTS.edgeLabel,
  edgeLineWidth: STROKE_WIDTHS.connector,
  groupCornerRadius: 0,
  groupHeaderFontSize: FONT_SIZES.groupHeader,
  groupHeaderFontWeight: FONT_WEIGHTS.groupHeader,
  groupLineWidth: STROKE_WIDTHS.outerBox,
  groupPaddingX: ER.boxPadX,
  groupPaddingY: 8,
  nodeCornerRadius: 0,
  nodeLabelFontSize: FONT_SIZES.nodeLabel,
  nodeLabelFontWeight: FONT_WEIGHTS.nodeLabel,
  nodeLineWidth: STROKE_WIDTHS.outerBox,
  nodePaddingX: ER.boxPadX,
  nodePaddingY: 8,
}

type EntitySizeMap = Map<string, { width: number; height: number; headerHeight: number }>

/** Build ELK graph and size map from an ER diagram. */
function buildErElkGraph(
  diagram: ErDiagram,
  options: RenderOptions
): { elkGraph: ElkNode; entitySizes: EntitySizeMap } {
  const style = resolveRenderStyle(options, ER_STYLE_DEFAULTS)
  const entitySizes: EntitySizeMap = new Map()

  for (const entity of diagram.entities) {
    const headerTextW = estimateTextWidth(entity.label, style.nodeLabelFontSize, style.nodeLabelFontWeight)
    let maxAttrW = 0
    for (const attr of entity.attributes) {
      const attrText = `${attr.type}  ${attr.name}${attr.keys.length > 0 ? `  ${  attr.keys.join(',')}` : ''}`
      const w = estimateMonoTextWidth(attrText, ER.attrFontSize)
      if (w > maxAttrW) {maxAttrW = w}
    }
    const width = Math.max(ER.minWidth, headerTextW + style.nodePaddingX * 2, maxAttrW + style.nodePaddingX * 2)
    const headerHeight = Math.max(ER.headerHeight, measureMultilineText(entity.label, style.nodeLabelFontSize, style.nodeLabelFontWeight).height + style.nodePaddingY * 2)
    const height = headerHeight + Math.max(entity.attributes.length, 1) * ER.rowHeight
    entitySizes.set(entity.id, { headerHeight, height, width })
  }

  const elkGraph: ElkNode = {
    children: [],
    edges: [],
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeLabels.placement': 'CENTER',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(ER.layerSpacing),
      'elk.padding': `[top=${ER.padding},left=${ER.padding},bottom=${ER.padding},right=${ER.padding}]`,
      'elk.spacing.nodeNode': String(ER.nodeSpacing),
    },
  }

  for (const entity of diagram.entities) {
    const size = entitySizes.get(entity.id)!
    elkGraph.children!.push({ height: size.height, id: entity.id, width: size.width })
  }

  for (let i = 0; i < diagram.relationships.length; i++) {
    const rel = diagram.relationships[i]!
    const metrics = measureMultilineText(rel.label, style.edgeLabelFontSize, style.edgeLabelFontWeight)
    const edge: ElkExtendedEdge = { id: `e${i}`, sources: [rel.entity1], targets: [rel.entity2] }
    if (rel.label) {
      edge.labels = [{ height: metrics.height + 6, text: rel.label, width: metrics.width + 8 }]
    }
    elkGraph.edges!.push(edge)
  }

  return { elkGraph, entitySizes }
}

/** Extract positioned entities and relationships from ELK result. */
function extractErLayout(
  result: ElkNode,
  diagram: ErDiagram,
  entitySizes: EntitySizeMap
): PositionedErDiagram {
  const entityLookup = new Map<string, ErEntity>()
  for (const entity of diagram.entities) {entityLookup.set(entity.id, entity)}

  const positionedEntities: PositionedErEntity[] = []
  for (const child of result.children ?? []) {
    const entity = entityLookup.get(child.id)
    if (entity) {
      positionedEntities.push({
        attributes: entity.attributes,
        headerHeight: entitySizes.get(entity.id)!.headerHeight,
        height: child.height ?? entitySizes.get(entity.id)!.height,
        id: entity.id,
        label: entity.label,
        rowHeight: ER.rowHeight,
        width: child.width ?? entitySizes.get(entity.id)!.width,
        x: child.x ?? 0,
        y: child.y ?? 0,
      })
    }
  }

  const relationships: PositionedErRelationship[] = []
  for (let i = 0; i < (result.edges?.length ?? 0); i++) {
    const elkEdge = result.edges![i]!
    const rel = diagram.relationships[i]!

    const points: Point[] = []
    if (elkEdge.sections && elkEdge.sections.length > 0) {
      const section = elkEdge.sections[0]!
      points.push({ x: section.startPoint.x, y: section.startPoint.y })
      if (section.bendPoints) {
        for (const bp of section.bendPoints) {
          points.push({ x: bp.x, y: bp.y })
        }
      }
      points.push({ x: section.endPoint.x, y: section.endPoint.y })
    }

    relationships.push({
      cardinality1: rel.cardinality1,
      cardinality2: rel.cardinality2,
      entity1: rel.entity1,
      entity2: rel.entity2,
      identifying: rel.identifying,
      label: rel.label,
      points,
    })
  }

  return {
    accessibilityDescription: diagram.accessibilityDescription,
    accessibilityTitle: diagram.accessibilityTitle,
    entities: positionedEntities,
    height: result.height ?? 400,
    relationships,
    width: result.width ?? 600,
  }
}

/**
 * Lay out a parsed ER diagram using ELK.js (synchronous).
 */
export function layoutErDiagramSync(
  diagram: ErDiagram,
  options: RenderOptions = {}
): PositionedErDiagram {
  if (diagram.entities.length === 0) {
    return { accessibilityDescription: diagram.accessibilityDescription, accessibilityTitle: diagram.accessibilityTitle, entities: [], height: 0, relationships: [], width: 0 }
  }

  const { elkGraph, entitySizes } = buildErElkGraph(diagram, options)
  const result = elkLayoutSync(elkGraph)
  return extractErLayout(result, diagram, entitySizes)
}
