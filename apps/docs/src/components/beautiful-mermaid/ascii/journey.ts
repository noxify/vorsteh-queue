// ============================================================================
// ASCII renderer — journey diagrams
//
// Renders Mermaid user journeys as compact scored task lists with optional
// section headings and actor annotations.
// ============================================================================

import { parseJourneyDiagram } from '../journey/parser'
import { preprocessMermaidLines } from '../mermaid-source'
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

function renderScoreSegments(score: number, useAscii: boolean): StyledSegment[] {
  const filled = useAscii ? '#' : '●'
  const empty = useAscii ? '.' : '○'

  const segments: StyledSegment[] = [
    { role: 'arrow', text: filled.repeat(score) },
    { role: 'border', text: empty.repeat(5 - score) },
  ]
  return segments.filter(segment => segment.text.length > 0)
}

/**
 * Render a Mermaid journey diagram to ASCII/Unicode text.
 */
export function renderJourneyAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = DEFAULT_ASCII_THEME,
): string {
  const lines = preprocessMermaidLines(text)
  const diagram = parseJourneyDiagram(lines)
  const {useAscii} = config
  const out: string[] = []
  const pushLine = (segments: StyledSegment[] = []): void => {
    out.push(segments.length === 0 ? '' : renderStyledLine(segments, colorMode, theme))
  }

  if (diagram.title) {
    for (const line of diagram.title.split('\n')) {
      pushLine([{ role: 'text', text: line }])
    }
    pushLine()
  }

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!

    if (section.label) {
      pushLine([
        { role: 'border', text: '[' },
        { role: 'text', text: section.label.replace(/\n/g, ' / ') },
        { role: 'border', text: ']' },
      ])
    }

    for (let taskIndex = 0; taskIndex < section.tasks.length; taskIndex++) {
      const task = section.tasks[taskIndex]!
      const scoreSegments = renderScoreSegments(task.score, useAscii)
      const scoreWidth = 5
      const taskLines = task.text.split('\n')

      pushLine([
        ...scoreSegments,
        { role: null, text: ' ' },
        { role: 'text', text: taskLines[0] ?? '' },
      ])
      for (const line of taskLines.slice(1)) {
        pushLine([
          { role: null, text: `${' '.repeat(scoreWidth + 1)} ` },
          { role: 'text', text: line },
        ])
      }

      if (task.actors.length > 0) {
        pushLine([
          { role: null, text: '  ' },
          { role: 'border', text: 'by' },
          { role: null, text: ' ' },
          { role: 'text', text: task.actors.join(', ') },
        ])
      }

      const moreTasks = taskIndex < section.tasks.length - 1
      const moreSections = sectionIndex < diagram.sections.length - 1
      if (moreTasks || moreSections) {pushLine()}
    }
  }

  return out.join('\n').trimEnd()
}
