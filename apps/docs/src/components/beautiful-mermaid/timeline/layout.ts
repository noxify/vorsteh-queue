import type {
  TimelineDiagram,
  PositionedTimelineDiagram,
  PositionedTimelineSection,
  PositionedTimelinePeriod,
  PositionedTimelineEvent,
} from './types'
import type { RenderOptions } from '../types'
import { measureMultilineText, measureTextWidth } from '../text-metrics'
import { STROKE_WIDTHS, resolveRenderStyle } from '../styles'
import type { RenderStyleDefaults } from '../styles'
import { stripFormattingTags } from '../multiline-utils'

// ============================================================================
// Timeline diagram layout engine
//
// Computes direct coordinates for a horizontal timeline with:
//   - optional section frames
//   - period pills above the rail
//   - stacked event cards below the rail
// ============================================================================

const TL = {
  columnGap: 24,
  eventFontSize: 12,
  eventFontWeight: 400,
  eventGap: 10,
  eventMinWidth: 128,
  eventPadX: 14,
  eventPadY: 10,
  eventWrapWidth: 148,
  markerRadius: 8,
  paddingX: 32,
  paddingY: 28,
  pillFontSize: 12,
  pillFontWeight: 600,
  pillMinWidth: 72,
  pillPadX: 12,
  pillPadY: 8,
  pillWrapWidth: 116,
  railToEventsGap: 28,
  railToPillGap: 22,
  sectionFontSize: 12,
  sectionFontWeight: 600,
  sectionGap: 28,
  sectionHeaderGap: 14,
  sectionHeaderHeight: 24,
  sectionHeaderPadX: 12,
  sectionPadBottom: 18,
  sectionPadX: 18,
  sectionWrapWidth: 168,
  titleFontSize: 18,
  titleFontWeight: 600,
  titleGap: 24,
  titleWrapWidth: 420,
} as const

const TIMELINE_STYLE_DEFAULTS: RenderStyleDefaults = {
  edgeLabelFontSize: TL.pillFontSize,
  edgeLabelFontWeight: TL.pillFontWeight,
  edgeLineWidth: 1.5,
  groupCornerRadius: 0,
  groupHeaderFontSize: TL.sectionFontSize,
  groupHeaderFontWeight: TL.sectionFontWeight,
  groupLabelPaddingX: TL.sectionHeaderPadX,
  groupLineWidth: STROKE_WIDTHS.outerBox,
  groupPaddingX: TL.sectionPadX,
  groupPaddingY: TL.sectionPadBottom,
  nodeCornerRadius: 0,
  nodeLabelFontSize: TL.eventFontSize,
  nodeLabelFontWeight: TL.eventFontWeight,
  nodeLineWidth: STROKE_WIDTHS.outerBox,
  nodePaddingX: TL.eventPadX,
  nodePaddingY: TL.eventPadY,
}

interface PeriodMetric {
  label: string
  pillWidth: number
  pillHeight: number
  columnWidth: number
  stackHeight: number
  events: { text: string; width: number; height: number }[]
}

interface SectionMetric {
  label?: string
  headerWidth: number
  innerWidth: number
  columnAreaWidth: number
  periods: PeriodMetric[]
  maxStackHeight: number
}

/**
 * Lay out a parsed timeline diagram.
 */
export function layoutTimelineDiagram(
  diagram: TimelineDiagram,
  options: RenderOptions = {}
): PositionedTimelineDiagram {
  const style = resolveRenderStyle(options, TIMELINE_STYLE_DEFAULTS)
  const hasNamedSections = diagram.sections.some(section => !!section.label)
  const showSectionFrames = diagram.sections.length > 1 || hasNamedSections
  const sectionHeaderHeight = hasNamedSections ? Math.max(TL.sectionHeaderHeight, style.groupHeaderFontSize + style.groupPaddingY) : 0
  const sectionPadX = showSectionFrames ? style.groupPaddingX : 0
  const titleText = diagram.title
    ? wrapTimelineText(diagram.title, TL.titleWrapWidth, TL.titleFontSize, TL.titleFontWeight)
    : undefined

  const titleMetrics = titleText
    ? measureMultilineText(titleText, TL.titleFontSize, TL.titleFontWeight)
    : undefined

  const metrics: SectionMetric[] = diagram.sections.map(section => {
    const wrappedSectionLabel = section.label
      ? wrapTimelineText(section.label, TL.sectionWrapWidth, style.groupHeaderFontSize, style.groupHeaderFontWeight)
      : undefined
    const periodMetrics: PeriodMetric[] = section.periods.map(period => {
      const wrappedPeriodLabel = wrapTimelineText(period.label, TL.pillWrapWidth, style.edgeLabelFontSize, style.edgeLabelFontWeight)
      const pillText = measureMultilineText(wrappedPeriodLabel, style.edgeLabelFontSize, style.edgeLabelFontWeight)
      const pillWidth = Math.max(TL.pillMinWidth, pillText.width + style.nodePaddingX * 2)
      const pillHeight = pillText.height + style.nodePaddingY * 2

      const eventMetrics = period.events.map(event => {
        const wrappedEventText = wrapTimelineText(event.text, TL.eventWrapWidth, style.nodeLabelFontSize, style.nodeLabelFontWeight)
        const text = measureMultilineText(wrappedEventText, style.nodeLabelFontSize, style.nodeLabelFontWeight)
        return {
          height: text.height + style.nodePaddingY * 2,
          text: wrappedEventText,
          width: Math.max(TL.eventMinWidth, text.width + style.nodePaddingX * 2),
        }
      })

      const columnWidth = Math.max(
        pillWidth,
        ...eventMetrics.map(event => event.width),
      )

      const stackHeight = eventMetrics.reduce((sum, event, index) => {
        const gap = index === 0 ? 0 : TL.eventGap
        return sum + gap + event.height
      }, 0)

      return {
        columnWidth,
        events: eventMetrics,
        label: wrappedPeriodLabel,
        pillHeight,
        pillWidth,
        stackHeight,
      }
    })

    const columnAreaWidth = periodMetrics.reduce((sum, period, index) => {
      const gap = index === 0 ? 0 : TL.columnGap
      return sum + gap + period.columnWidth
    }, 0)

    const headerWidth = wrappedSectionLabel
      ? measureMultilineText(wrappedSectionLabel, style.groupHeaderFontSize, style.groupHeaderFontWeight).width + style.groupLabelPaddingX * 2
      : 0

    const innerWidth = Math.max(columnAreaWidth, headerWidth)
    const maxStackHeight = Math.max(0, ...periodMetrics.map(period => period.stackHeight))

    return {
      columnAreaWidth,
      headerWidth,
      innerWidth,
      label: wrappedSectionLabel,
      maxStackHeight,
      periods: periodMetrics,
    }
  })

  const maxPillHeight = Math.max(
    0,
    ...metrics.flatMap(section => section.periods.map(period => period.pillHeight)),
  )

  let contentTop = TL.paddingY
  if (titleMetrics) {
    contentTop += titleMetrics.height
    contentTop += TL.titleGap
  }

  const pillY = contentTop + sectionHeaderHeight + (hasNamedSections ? TL.sectionHeaderGap : 0)
  const railY = pillY + maxPillHeight + TL.railToPillGap
  const eventsTop = railY + TL.railToEventsGap

  let cursorX = TL.paddingX
  const sections: PositionedTimelineSection[] = []
  let maxBottom = railY + TL.markerRadius

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!
    const metric = metrics[sectionIndex]!
    const sectionWidth = metric.innerWidth + sectionPadX * 2
    const columnStartX = cursorX + sectionPadX + (metric.innerWidth - metric.columnAreaWidth) / 2

    let periodCursorX = columnStartX
    const periods: PositionedTimelinePeriod[] = []
    let sectionBottom = railY + TL.markerRadius

    for (let periodIndex = 0; periodIndex < section.periods.length; periodIndex++) {
      const period = section.periods[periodIndex]!
      const periodMetric = metric.periods[periodIndex]!
      const centerX = periodCursorX + periodMetric.columnWidth / 2

      let eventY = eventsTop
      const events: PositionedTimelineEvent[] = period.events.map((event, eventIndex) => {
        const eventMetric = periodMetric.events[eventIndex]!
        const positioned: PositionedTimelineEvent = {
          height: eventMetric.height,
          id: event.id,
          periodId: period.id,
          periodLabel: periodMetric.label,
          sectionId: section.id,
          text: eventMetric.text,
          width: eventMetric.width,
          x: centerX - eventMetric.width / 2,
          y: eventY,
        }
        eventY += eventMetric.height + TL.eventGap
        return positioned
      })

      const stemBottomY = events.length > 0 ? events[0]!.y - 10 : railY + 16

      periods.push({
        centerX,
        events,
        id: period.id,
        label: periodMetric.label,
        markerY: railY,
        pillHeight: periodMetric.pillHeight,
        pillWidth: periodMetric.pillWidth,
        pillX: centerX - periodMetric.pillWidth / 2,
        pillY,
        sectionId: section.id,
        stemBottomY,
        stemTopY: railY + TL.markerRadius,
      })

      if (events.length > 0) {
        const lastEvent = events.at(-1)!
        sectionBottom = Math.max(sectionBottom, lastEvent.y + lastEvent.height)
      }

      periodCursorX += periodMetric.columnWidth + TL.columnGap
    }

    sectionBottom += style.groupPaddingY
    maxBottom = Math.max(maxBottom, sectionBottom)

    sections.push({
      framed: showSectionFrames,
      headerHeight: sectionHeaderHeight,
      height: sectionBottom - contentTop,
      id: section.id,
      label: metric.label,
      periods,
      width: sectionWidth,
      x: cursorX,
      y: contentTop,
    })

    cursorX += sectionWidth
    if (sectionIndex < diagram.sections.length - 1) {
      cursorX += showSectionFrames ? TL.sectionGap : TL.columnGap
    }
  }

  const width = cursorX + TL.paddingX
  const height = maxBottom + TL.paddingY
  const allPeriods = sections.flatMap(section => section.periods)
  const firstCenter = allPeriods[0]?.centerX ?? TL.paddingX
  const lastCenter = allPeriods.at(-1)?.centerX ?? width - TL.paddingX

  return {
    accessibilityDescription: diagram.accessibilityDescription,
    accessibilityTitle: diagram.accessibilityTitle,
    height,
    rail: {
      x1: firstCenter === lastCenter ? firstCenter - 42 : firstCenter,
      x2: firstCenter === lastCenter ? lastCenter + 42 : lastCenter,
      y: railY,
    },
    sections,
    title: titleText
      ? {
          text: titleText,
          x: width / 2,
          y: TL.paddingY + titleMetrics!.height / 2,
        }
      : undefined,
    width,
  }
}

function wrapTimelineText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
): string {
  return text
    .split('\n')
    .flatMap(line => wrapTimelineLine(line, maxWidth, fontSize, fontWeight))
    .join('\n')
}

function wrapTimelineLine(
  line: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
): string[] {
  const plainLine = stripFormattingTags(line)
  if (measureTextWidth(plainLine, fontSize, fontWeight) <= maxWidth) {
    return [line]
  }

  const words = line.trim().split(/\s+/)
  if (words.length <= 1) {
    return breakLongToken(line, maxWidth, fontSize, fontWeight)
  }

  const wrapped: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    const candidateWidth = measureTextWidth(stripFormattingTags(candidate), fontSize, fontWeight)

    if (candidateWidth <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      wrapped.push(current)
      current = ''
    }

    if (measureTextWidth(stripFormattingTags(word), fontSize, fontWeight) > maxWidth) {
      wrapped.push(...breakLongToken(word, maxWidth, fontSize, fontWeight))
    } else {
      current = word
    }
  }

  if (current) {wrapped.push(current)}
  return wrapped
}

function breakLongToken(
  token: string,
  maxWidth: number,
  fontSize: number,
  fontWeight: number,
): string[] {
  const chunks: string[] = []
  let current = ''

  for (const char of token) {
    const candidate = current + char
    if (current && measureTextWidth(stripFormattingTags(candidate), fontSize, fontWeight) > maxWidth) {
      chunks.push(current)
      current = char
      continue
    }

    current = candidate
  }

  if (current) {chunks.push(current)}
  return chunks
}
