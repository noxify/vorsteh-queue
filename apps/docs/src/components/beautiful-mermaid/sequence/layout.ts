import type { SequenceDiagram, PositionedSequenceDiagram, PositionedActor, Lifeline, PositionedMessage, Activation, PositionedBlock, PositionedNote } from './types'
import type { RenderOptions } from '../types'
import { estimateTextWidth, FONT_SIZES, FONT_WEIGHTS, STROKE_WIDTHS, resolveRenderStyle } from '../styles'
import type { RenderStyleDefaults } from '../styles'
import { measureMultilineText } from '../text-metrics'

// ============================================================================
// Sequence diagram layout engine
//
// Custom timeline-based layout (no ELK — sequence diagrams aren't graphs).
//
// Layout strategy:
//   1. Space actors horizontally based on label widths + min gap
//   2. Stack messages vertically in chronological order
//   3. Track activation boxes via a stack
//   4. Position blocks (loop/alt/opt) as background rectangles
//   5. Position notes next to their target actors
// ============================================================================

/** Layout constants specific to sequence diagrams */
const SEQ = {
  /** Activation box width (narrow rectangle on lifeline) */
  activationWidth: 10,
  /** Minimum gap between actor centers */
  actorGap: 140,
  /** Actor box height */
  actorHeight: 40,
  /** Horizontal padding inside actor boxes */
  actorPadX: 16,
  /** Extra vertical space before the first message in a block (room for the header label) */
  blockHeaderExtra: 28,
  blockPadBottom: 8,
  blockPadTop: 40,
  /** Block padding (loop/alt borders) */
  blockPadX: 10,
  /** Extra vertical space before a message at a divider boundary (room for else/and label) */
  dividerExtra: 24,
  /** Vertical space between actor boxes and first message */
  headerGap: 20,
  /** Vertical space per message row */
  messageRowHeight: 40,
  noteGap: 10,
  notePadX: 12,
  notePadY: 6,
  /** Note dimensions */
  noteWidth: 60,
  /** Padding around the entire diagram */
  padding: 30,
  /** Extra vertical space for self-messages (they loop back) */
  selfMessageHeight: 30,
} as const

const SEQUENCE_STYLE_DEFAULTS: RenderStyleDefaults = {
  edgeLabelFontSize: FONT_SIZES.edgeLabel,
  edgeLabelFontWeight: FONT_WEIGHTS.edgeLabel,
  edgeLineWidth: STROKE_WIDTHS.connector,
  groupCornerRadius: 0,
  groupHeaderFontSize: FONT_SIZES.edgeLabel,
  groupHeaderFontWeight: FONT_WEIGHTS.groupHeader,
  groupLabelPaddingX: 6,
  groupLineWidth: STROKE_WIDTHS.outerBox,
  groupPaddingX: SEQ.blockPadX,
  groupPaddingY: 8,
  nodeLabelFontSize: FONT_SIZES.nodeLabel,
  nodeLabelFontWeight: FONT_WEIGHTS.nodeLabel,
  nodePaddingX: SEQ.actorPadX,
  nodePaddingY: SEQ.notePadY,
}

/**
 * Lay out a parsed sequence diagram.
 * Returns a fully positioned diagram ready for SVG rendering.
 */
export function layoutSequenceDiagram(
  diagram: SequenceDiagram,
  options: RenderOptions = {}
): PositionedSequenceDiagram {
  const style = resolveRenderStyle(options, SEQUENCE_STYLE_DEFAULTS)
  const actorHeight = Math.max(SEQ.actorHeight, measureMultilineText('Mg', style.nodeLabelFontSize, style.nodeLabelFontWeight).height + style.nodePaddingY * 2)
  const defaultEdgeTextHeight = measureMultilineText('Mg', SEQUENCE_STYLE_DEFAULTS.edgeLabelFontSize, SEQUENCE_STYLE_DEFAULTS.edgeLabelFontWeight).height
  const edgeTextHeight = measureMultilineText('Mg', style.edgeLabelFontSize, style.edgeLabelFontWeight).height
  const messageRowHeight = Math.max(SEQ.messageRowHeight, SEQ.messageRowHeight + edgeTextHeight - defaultEdgeTextHeight)
  const selfMessageHeight = Math.max(SEQ.selfMessageHeight, messageRowHeight - 10)
  const blockPadTop = Math.max(
    SEQ.blockPadTop,
    SEQ.blockPadTop
      + (style.groupHeaderFontSize - SEQUENCE_STYLE_DEFAULTS.groupHeaderFontSize)
      + (style.groupPaddingY - SEQUENCE_STYLE_DEFAULTS.groupPaddingY) * 2,
  )
  if (diagram.actors.length === 0) {
    return { accessibilityDescription: diagram.accessibilityDescription, accessibilityTitle: diagram.accessibilityTitle, activations: [], actors: [], blocks: [], height: 0, lifelines: [], messages: [], notes: [], width: 0 }
  }

  // 1. Calculate actor widths and assign horizontal positions (center X)
  const actorWidths = diagram.actors.map(a => {
    const textW = estimateTextWidth(a.label, style.nodeLabelFontSize, style.nodeLabelFontWeight)
    return Math.max(textW + style.nodePaddingX * 2, 80)
  })

  // Build actor center X positions with minimum gap
  const actorCenterX: number[] = []
  let currentX = SEQ.padding + actorWidths[0]! / 2
  for (let i = 0; i < diagram.actors.length; i++) {
    if (i > 0) {
      const minGap = Math.max(SEQ.actorGap, (actorWidths[i - 1]! + actorWidths[i]!) / 2 + 40)
      currentX += minGap
    }
    actorCenterX.push(currentX)
  }

  // Build actor ID → index lookup
  const actorIndex = new Map<string, number>()
  for (let i = 0; i < diagram.actors.length; i++) {
    actorIndex.set(diagram.actors[i]!.id, i)
  }

  // 2. Position actors at the top
  const actorY = SEQ.padding
  const actors: PositionedActor[] = diagram.actors.map((a, i) => ({
    height: actorHeight,
    id: a.id,
    label: a.label,
    type: a.type,
    width: actorWidths[i]!,
    x: actorCenterX[i]!,
    y: actorY,
  }))

  // 3. Stack messages vertically
  let messageY = actorY + actorHeight + SEQ.headerGap
  const messages: PositionedMessage[] = []

  // Pre-scan blocks to determine which message indices need extra vertical
  // space for block headers (e.g. "alt [Valid credentials]") or divider
  // labels (e.g. "[else Invalid]"). Without this, messages inside blocks
  // overlap with the header/divider text that sits above them.
  const extraSpaceBefore = new Map<number, number>()
  for (const block of diagram.blocks) {
    // First message in the block needs room for the block header label
    const prev = extraSpaceBefore.get(block.startIndex) ?? 0
    extraSpaceBefore.set(block.startIndex, Math.max(prev, SEQ.blockHeaderExtra))

    // Each divider (else/and) needs room for the divider label
    for (const div of block.dividers) {
      const prevDiv = extraSpaceBefore.get(div.index) ?? 0
      extraSpaceBefore.set(div.index, Math.max(prevDiv, SEQ.dividerExtra))
    }
  }

  // Pre-group notes by the message index they follow, so we can position
  // them inline during the message stacking loop (avoids overlap bugs).
  const notesByAfterIndex = new Map<number, typeof diagram.notes>()
  for (const note of diagram.notes) {
    const list = notesByAfterIndex.get(note.afterIndex) ?? []
    list.push(note)
    notesByAfterIndex.set(note.afterIndex, list)
  }
  const positionedNotes: PositionedNote[] = []

  // Track activation stack per actor: array of { startY, depth } objects
  // Depth is used to offset nested activations horizontally for visual clarity
  const activationStacks = new Map<string, { startY: number; depth: number }[]>()
  const activations: Activation[] = []
  const nestingOffset = 4 // Horizontal offset per nesting level

  const positionNote = (note: typeof diagram.notes[number], noteY: number): PositionedNote => {
    const noteW = Math.max(
      SEQ.noteWidth,
      estimateTextWidth(note.text, style.nodeLabelFontSize, style.nodeLabelFontWeight) + style.nodePaddingX * 2
    )
    const noteH = measureMultilineText(note.text, style.nodeLabelFontSize, style.nodeLabelFontWeight).height + style.nodePaddingY * 2
    const firstActorIdx = actorIndex.get(note.actorIds[0] ?? '') ?? 0
    let noteX: number
    if (note.position === 'left') {
      noteX = actorCenterX[firstActorIdx]! - actorWidths[firstActorIdx]! / 2 - noteW - SEQ.noteGap
    } else if (note.position === 'right') {
      noteX = actorCenterX[firstActorIdx]! + actorWidths[firstActorIdx]! / 2 + SEQ.noteGap
    } else if (note.actorIds.length > 1) {
      const lastActorIdx = actorIndex.get(note.actorIds.at(-1) ?? '') ?? firstActorIdx
      noteX = (actorCenterX[firstActorIdx]! + actorCenterX[lastActorIdx]!) / 2 - noteW / 2
    } else {
      noteX = actorCenterX[firstActorIdx]! - noteW / 2
    }
    return {
      actors: note.actorIds,
      height: noteH,
      position: note.position,
      text: note.text,
      width: noteW,
      x: noteX,
      y: noteY,
    }
  }

  const notesBeforeFirstMsg = notesByAfterIndex.get(-1)
  if (notesBeforeFirstMsg && notesBeforeFirstMsg.length > 0) {
    let noteY = messageY
    for (const note of notesBeforeFirstMsg) {
      const positioned = positionNote(note, noteY)
      positionedNotes.push(positioned)
      noteY += positioned.height + 4
    }
    messageY = Math.max(messageY, noteY + messageRowHeight / 2)
  }

  for (let msgIdx = 0; msgIdx < diagram.messages.length; msgIdx++) {
    const msg = diagram.messages[msgIdx]!
    const fromIdx = actorIndex.get(msg.from) ?? 0
    const toIdx = actorIndex.get(msg.to) ?? 0
    const isSelf = msg.from === msg.to

    // Add extra vertical space if this message sits below a block header or divider
    const extra = extraSpaceBefore.get(msgIdx) ?? 0
    if (extra > 0) {messageY += extra}

    const x1 = actorCenterX[fromIdx]!
    const x2 = actorCenterX[toIdx]!

    messages.push({
      arrowHead: msg.arrowHead,
      from: msg.from,
      isSelf,
      label: msg.label,
      lineStyle: msg.lineStyle,
      to: msg.to,
      x1,
      x2,
      y: messageY,
    })

    // Handle activation - track nesting depth for visual offset
    if (msg.activate) {
      if (!activationStacks.has(msg.to)) {
        activationStacks.set(msg.to, [])
      }
      const stack = activationStacks.get(msg.to)!
      const depth = stack.length // Current depth before pushing
      stack.push({ depth, startY: messageY })
    }

    if (msg.deactivate) {
      const stack = activationStacks.get(msg.from)
      if (stack && stack.length > 0) {
        const { startY, depth } = stack.pop()!
        const idx = actorIndex.get(msg.from) ?? 0
        // Offset nested activations to the right for visual distinction
        const xOffset = depth * nestingOffset
        activations.push({
          actorId: msg.from,
          bottomY: messageY,
          topY: startY,
          width: SEQ.activationWidth,
          x: actorCenterX[idx]! - SEQ.activationWidth / 2 + xOffset,
        })
      }
    }

    // Advance messageY past the message itself
    messageY += isSelf ? selfMessageHeight + messageRowHeight : messageRowHeight

    // Position notes that appear after this message.
    // Notes start below the self-message loop (if self) or below the arrow,
    // and consecutive notes stack vertically. If notes extend beyond the
    // normal message advance, push messageY further so subsequent messages
    // don't overlap.
    const notesForMsg = notesByAfterIndex.get(msgIdx)
    if (notesForMsg && notesForMsg.length > 0) {
      // Self-message loops extend selfMessageHeight below msg.y;
      // normal arrows sit at msg.y with no extension below.
      const selfLoopExtra = isSelf ? selfMessageHeight : 0
      let noteY = messages[msgIdx]!.y + selfLoopExtra + 8

      for (const note of notesForMsg) {
        const positioned = positionNote(note, noteY)
        positionedNotes.push(positioned)
        noteY += positioned.height + 4 // Stack next note below with gap
      }

      // Push messageY forward if notes extended beyond the normal advance.
      // Add half a row height so the next message's label (rendered at msg.y - 6)
      // has clearance from the last note's bottom edge.
      messageY = Math.max(messageY, noteY + messageRowHeight / 2)
    }
  }

  // Close any unclosed activations (preserving depth for offset)
  for (const [actorId, stack] of activationStacks) {
    for (const { startY, depth } of stack) {
      const idx = actorIndex.get(actorId) ?? 0
      const xOffset = depth * nestingOffset
      activations.push({
        actorId,
        bottomY: messageY - messageRowHeight / 2,
        topY: startY,
        width: SEQ.activationWidth,
        x: actorCenterX[idx]! - SEQ.activationWidth / 2 + xOffset,
      })
    }
  }

  // 4. Position blocks (loop/alt/opt)
  const blocks: PositionedBlock[] = diagram.blocks.map(block => {
    // Block spans from the Y of startIndex to endIndex messages
    const startMsg = messages[block.startIndex]
    const endMsg = messages[block.endIndex]
    const blockTop = (startMsg?.y ?? messageY) - blockPadTop
    const blockBottom = (endMsg?.y ?? messageY) + style.groupPaddingY + 12

    // Block width spans all actors involved in its messages
    const involvedActors = new Set<number>()
    for (let mi = block.startIndex; mi <= block.endIndex; mi++) {
      const m = diagram.messages[mi]
      if (m) {
        involvedActors.add(actorIndex.get(m.from) ?? 0)
        involvedActors.add(actorIndex.get(m.to) ?? 0)
      }
    }
    // Fallback: span all actors if none involved
    if (involvedActors.size === 0) {
      for (let ai = 0; ai < diagram.actors.length; ai++) {involvedActors.add(ai)}
    }
    const minIdx = Math.min(...involvedActors)
    const maxIdx = Math.max(...involvedActors)
    const blockLeft = actorCenterX[minIdx]! - actorWidths[minIdx]! / 2 - style.groupPaddingX
    const blockRight = actorCenterX[maxIdx]! + actorWidths[maxIdx]! / 2 + style.groupPaddingX

    // Position dividers — offset from message Y so the divider label text
    // (rendered at divider.y + 14 in the renderer) clears the message label
    // (rendered at msg.y - 6).
    //
    // Default offset 28 gives ~8px baseline clearance, which is sufficient
    // when the divider label (left-aligned at block edge) and message label
    // (centered between actors) don't share horizontal space. When they DO
    // overlap horizontally (e.g. long divider labels like "[Account locked]"
    // next to centered message labels like "403 Forbidden"), we increase the
    // offset to 36 so text bounding boxes have ~5px visual clearance.
    const dividers = block.dividers.map(d => {
      const msg = messages[d.index]
      const msgY = msg?.y ?? messageY
      let offset = 28

      // Dynamic overlap detection: increase offset when the divider label
      // and message label occupy the same horizontal region, which would
      // cause vertical text overlap at the default 8px baseline gap.
      if (d.label && msg?.label) {
        const divLabelText = `[${d.label}]`
        const divLabelW = estimateTextWidth(divLabelText, style.edgeLabelFontSize, style.edgeLabelFontWeight)
        const divLabelLeft = blockLeft + 8
        const divLabelRight = divLabelLeft + divLabelW

        const msgLabelW = estimateTextWidth(msg.label, style.edgeLabelFontSize, style.edgeLabelFontWeight)
        // Self-messages render labels at x1 + 36 (left-aligned); normal
        // messages center the label between the two actor lifelines.
        const msgLabelLeft = msg.isSelf
          ? msg.x1 + 36
          : (msg.x1 + msg.x2) / 2 - msgLabelW / 2
        const msgLabelRight = msgLabelLeft + msgLabelW

        if (divLabelRight > msgLabelLeft && divLabelLeft < msgLabelRight) {
          offset = 36
        }
      }

      return { label: d.label, y: msgY - offset }
    })

    return {
      dividers,
      height: blockBottom - blockTop,
      label: block.label,
      type: block.type,
      width: blockRight - blockLeft,
      x: blockLeft,
      y: blockTop,
    }
  })

  // 5. Notes — already positioned inline during the message stacking loop
  //    (step 3) to properly account for self-message loops and vertical stacking.
  const notes = positionedNotes

  // 6. Bounding-box post-processing
  //
  // Notes positioned "left of" the first actor or "right of" the last actor
  // can extend beyond the actor-based viewport. Compute the true bounding box
  // across all positioned elements, then shift everything right if anything
  // extends left of the desired padding margin and expand the width to fit.
  const diagramBottom = messageY + SEQ.padding

  // Find global X extents across actors, blocks, notes, and message labels
  let globalMinX: number = SEQ.padding // actors already start at SEQ.padding
  let globalMaxX = 0
  for (const a of actors) {
    globalMinX = Math.min(globalMinX, a.x - a.width / 2)
    globalMaxX = Math.max(globalMaxX, a.x + a.width / 2)
  }
  for (const b of blocks) {
    globalMinX = Math.min(globalMinX, b.x)
    globalMaxX = Math.max(globalMaxX, b.x + b.width)
  }
  for (const n of notes) {
    globalMinX = Math.min(globalMinX, n.x)
    globalMaxX = Math.max(globalMaxX, n.x + n.width)
  }
  // Include self-message labels in bounding box — they extend to the right of the actor
  // and could be clipped if not accounted for in the SVG width
  for (const m of messages) {
    if (m.isSelf && m.label) {
      const loopW = 30 // matches renderer loopW
      const labelPadding = 8
      const labelLeft = m.x1 + loopW + labelPadding
      const labelWidth = estimateTextWidth(m.label, style.edgeLabelFontSize, style.edgeLabelFontWeight)
      globalMaxX = Math.max(globalMaxX, labelLeft + labelWidth + 8) // +8 for safety margin
    }
  }

  // If elements extend left of the desired padding, shift everything right
  const shiftX = globalMinX < SEQ.padding ? SEQ.padding - globalMinX : 0
  if (shiftX > 0) {
    for (const a of actors) {a.x += shiftX}
    for (const m of messages) { m.x1 += shiftX; m.x2 += shiftX }
    for (const act of activations) {act.x += shiftX}
    for (const b of blocks) { b.x += shiftX; }
    for (const n of notes) {n.x += shiftX}
    // Also shift actor center X array (used for lifelines below)
    for (let i = 0; i < actorCenterX.length; i++) {actorCenterX[i]! += shiftX}
  }

  // 7. Calculate final lifelines (after shift so X positions are correct)
  const lifelines: Lifeline[] = diagram.actors.map((a, i) => ({
    actorId: a.id,
    bottomY: diagramBottom - SEQ.padding,
    topY: actorY + actorHeight,
    x: actorCenterX[i]!,
  }))

  // 8. Calculate diagram dimensions from the bounding box
  const diagramWidth = globalMaxX + shiftX + SEQ.padding
  const diagramHeight = diagramBottom

  return {
    accessibilityDescription: diagram.accessibilityDescription,
    accessibilityTitle: diagram.accessibilityTitle,
    activations,
    actors,
    blocks,
    height: Math.max(diagramHeight, 100),
    lifelines,
    messages,
    notes,
    width: Math.max(diagramWidth, 200),
  }
}
