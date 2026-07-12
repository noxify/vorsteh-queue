// ============================================================================
// ASCII renderer — architecture diagrams
//
// Purpose-built renderer that preserves architecture-specific visual identity:
// group frames with headers, service cards with icon indicators, junction
// markers, and labeled edge connections.
// ============================================================================

import { parseArchitectureDiagram } from '../architecture/parser'
import type {
  ArchitectureChildRef,
  ArchitectureDiagram,
  ArchitectureEdge,
  ArchitectureGroup,
  ArchitectureJunction,
  ArchitectureService,
} from '../architecture/types'
import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi'
import type { AsciiConfig, AsciiTheme, CharRole, ColorMode } from './types'

interface StyledSegment {
  text: string
  role: CharRole | null
}

function renderStyledLine(
  segments: StyledSegment[],
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const chars: string[] = []
  const roles: (CharRole | null)[] = []

  for (const segment of segments) {
    for (const char of segment.text) {
      chars.push(char)
      roles.push(segment.role)
    }
  }

  return colorizeLine(chars, roles, theme, colorMode)
}

/**
 * Render a Mermaid architecture diagram to ASCII/Unicode text.
 */
export function renderArchitectureAscii(
  lines: string[],
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = DEFAULT_ASCII_THEME,
): string {
  const diagram = parseArchitectureDiagram(lines)
  const {useAscii} = config
  const out: string[] = []

  const pushLine = (segments: StyledSegment[] = []): void => {
    out.push(segments.length === 0 ? '' : renderStyledLine(segments, colorMode, theme))
  }

  const groupsById = new Map(diagram.groups.map((g) => [g.id, g]))
  const servicesById = new Map(diagram.services.map((s) => [s.id, s]))
  const junctionsById = new Map(diagram.junctions.map((j) => [j.id, j]))

  const tl = useAscii ? '+' : '┌'
  const tr = useAscii ? '+' : '┐'
  const bl = useAscii ? '+' : '└'
  const br = useAscii ? '+' : '┘'
  const h = useAscii ? '-' : '─'
  const v = useAscii ? '|' : '│'
  const arrow = useAscii ? '>' : '►'
  const arrowLeft = useAscii ? '<' : '◄'
  const dash = useAscii ? '-' : '─'
  const junctionMark = useAscii ? '(*)' : '◉'

  renderChildren(diagram.rootChildren, 0)

  if (diagram.edges.length > 0) {
    pushLine()
    for (const edge of diagram.edges) {
      renderEdgeLine(edge)
    }
  }

  return out.join('\n').trimEnd()

  function renderChildren(children: ArchitectureChildRef[], indent: number): void {
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci]!

      if (child.kind === 'group') {
        const group = groupsById.get(child.id)!
        renderGroup(group, indent)
      } else if (child.kind === 'service') {
        const service = servicesById.get(child.id)!
        renderService(service, indent)
      } else {
        const junction = junctionsById.get(child.id)!
        renderJunction(junction, indent)
      }

      if (ci < children.length - 1) {pushLine()}
    }
  }

  function renderGroup(group: ArchitectureGroup, indent: number): void {
    const pad = ' '.repeat(indent)
    const label = group.label.replaceAll(/\n/g, ' ')
    const iconTag = group.icon ? `(${group.icon})` : ''
    const header = `${iconTag}${iconTag ? ' ' : ''}${label}`
    const innerWidth = Math.max(header.length + 4, 30)
    const hBar = h.repeat(innerWidth - 2)

    pushLine([
      { role: null, text: pad },
      { role: 'border', text: tl + hBar + tr },
    ])
    pushLine([
      { role: null, text: pad },
      { role: 'border', text: v },
      { role: null, text: ' ' },
      { role: 'text', text: header },
      { role: null, text: ' '.repeat(Math.max(0, innerWidth - header.length - 3)) },
      { role: 'border', text: v },
    ])
    pushLine([
      { role: null, text: pad },
      { role: 'border', text: v + h.repeat(innerWidth - 2) + v },
    ])

    for (const child of group.children) {
      if (child.kind === 'group') {
        const nested = groupsById.get(child.id)!
        renderGroup(nested, indent + 2)
      } else if (child.kind === 'service') {
        const service = servicesById.get(child.id)!
        renderService(service, indent + 2)
      } else {
        const junction = junctionsById.get(child.id)!
        renderJunction(junction, indent + 2)
      }
    }

    pushLine([
      { role: null, text: pad },
      { role: 'border', text: bl + hBar + br },
    ])
  }

  function renderService(service: ArchitectureService, indent: number): void {
    const pad = ' '.repeat(indent)
    const icon = service.icon ? `[${service.icon}]` : ''
    const label = service.label.replaceAll(/\n/g, ' ')

    pushLine([
      { role: null, text: pad },
      ...(icon
        ? [
            { role: 'arrow' as CharRole, text: icon },
            { role: null as CharRole | null, text: ' ' },
          ]
        : []),
      { role: 'text', text: label },
    ])
  }

  function renderJunction(junction: ArchitectureJunction, indent: number): void {
    const pad = ' '.repeat(indent)

    pushLine([
      { role: null, text: pad },
      { role: 'arrow', text: junctionMark },
      { role: null, text: ' ' },
      { role: 'text', text: junction.id },
    ])
  }

  function renderEdgeLine(edge: ArchitectureEdge): void {
    const srcName = itemLabel(edge.source.id)
    const tgtName = itemLabel(edge.target.id)
    const left = edge.hasArrowStart ? arrowLeft + dash : dash + dash
    const right = edge.hasArrowEnd ? dash + arrow : dash + dash
    const label = edge.label ? ` ${edge.label.replaceAll(/\n/g, ' ')} ` : ''

    pushLine([
      { role: null, text: '  ' },
      { role: 'text', text: srcName },
      { role: 'border', text: `:${edge.source.side}` },
      { role: null, text: ' ' },
      { role: 'line', text: left },
      ...(label
        ? [
            { role: 'border' as CharRole, text: '[' },
            { role: 'text' as CharRole, text: label.trim() },
            { role: 'border' as CharRole, text: ']' },
          ]
        : []),
      { role: 'line', text: right },
      { role: null, text: ' ' },
      { role: 'border', text: `${edge.target.side}:` },
      { role: 'text', text: tgtName },
    ])
  }

  function itemLabel(id: string): string {
    const service = servicesById.get(id)
    if (service) {return service.label.replace(/\n/g, ' ')}
    return id
  }
}
