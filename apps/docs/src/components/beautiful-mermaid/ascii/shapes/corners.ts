// ============================================================================
// Corner character lookup table for shape rendering
// ============================================================================
//
// All shapes are rendered as rectangles with distinctive corner characters
// to indicate shape type. This eliminates diagonal characters while keeping
// shapes visually distinguishable.

import type { AsciiNodeShape } from '../types'

/**
 * Corner characters for a shape in both Unicode and ASCII modes.
 */
export interface CornerChars {
  /** Top-left corner */
  tl: string
  /** Top-right corner */
  tr: string
  /** Bottom-left corner */
  bl: string
  /** Bottom-right corner */
  br: string
}

/**
 * Shape corner configuration with both Unicode and ASCII variants.
 */
export interface ShapeCorners {
  unicode: CornerChars
  ascii: CornerChars
}

/**
 * Corner character lookup table for all shape types.
 *
 * Design principles:
 * - All shapes use orthogonal box structure (no diagonals)
 * - Corner characters indicate shape semantics
 * - ASCII fallbacks use available punctuation
 */
export const SHAPE_CORNERS: Record<AsciiNodeShape, ShapeCorners> = {
  // Standard rectangular shapes
  rectangle: {
    ascii: { bl: '+', br: '+', tl: '+', tr: '+' },
    unicode: { bl: '└', br: '┘', tl: '┌', tr: '┐' },
  },
  service: {
    ascii: { bl: '+', br: '+', tl: '+', tr: '+' },
    unicode: { bl: '└', br: '┘', tl: '┌', tr: '┐' },
  },
  rounded: {
    ascii: { bl: "'", br: "'", tl: '.', tr: '.' },
    unicode: { bl: '╰', br: '╯', tl: '╭', tr: '╮' },
  },

  // Circular shapes - use circle markers at corners
  circle: {
    ascii: { bl: 'o', br: 'o', tl: 'o', tr: 'o' },
    unicode: { bl: '◯', br: '◯', tl: '◯', tr: '◯' },
  },
  doublecircle: {
    ascii: { bl: '@', br: '@', tl: '@', tr: '@' },
    unicode: { bl: '◎', br: '◎', tl: '◎', tr: '◎' },
  },

  // Diamond - decision nodes
  diamond: {
    ascii: { bl: '<', br: '>', tl: '<', tr: '>' },
    unicode: { bl: '◇', br: '◇', tl: '◇', tr: '◇' },
  },

  // Hexagon - process nodes (crop corners — monospace-safe, distinct from rectangle)
  hexagon: {
    ascii: { bl: '*', br: '*', tl: '*', tr: '*' },
    unicode: { bl: '⌞', br: '⌟', tl: '⌜', tr: '⌝' },
  },

  // Stadium/pill shape
  stadium: {
    ascii: { bl: '(', br: ')', tl: '(', tr: ')' },
    unicode: { bl: '(', br: ')', tl: '(', tr: ')' },
  },

  // Subroutine - double vertical bars
  subroutine: {
    ascii: { bl: '|', br: '|', tl: '|', tr: '|' },
    unicode: { bl: '╟', br: '╢', tl: '╟', tr: '╢' },
  },

  // Cylinder/database
  cylinder: {
    ascii: { bl: "'", br: "'", tl: '.', tr: '.' },
    unicode: { bl: '╰', br: '╯', tl: '╭', tr: '╮' },
  },

  // Asymmetric/flag - pointer on left side
  asymmetric: {
    ascii: { bl: '>', br: '+', tl: '>', tr: '+' },
    unicode: { bl: '▷', br: '┘', tl: '▷', tr: '┐' },
  },

  // Trapezoid - wider at bottom (top corners slope inward)
  trapezoid: {
    ascii: { bl: '+', br: '+', tl: '/', tr: '\\' },
    unicode: { bl: '└', br: '┘', tl: '/', tr: '\\' },
  },

  // Trapezoid-alt - wider at top (bottom corners slope inward)
  'trapezoid-alt': {
    ascii: { bl: '\\', br: '/', tl: '+', tr: '+' },
    unicode: { bl: '\\', br: '/', tl: '┌', tr: '┐' },
  },

  // State diagram pseudostates (special handling, not corner-based)
  'state-start': {
    ascii: { bl: '*', br: '*', tl: '*', tr: '*' },
    unicode: { bl: '●', br: '●', tl: '●', tr: '●' },
  },
  'state-end': {
    ascii: { bl: '@', br: '@', tl: '@', tr: '@' },
    unicode: { bl: '◉', br: '◉', tl: '◉', tr: '◉' },
  },
}

/**
 * Get corner characters for a shape type.
 */
export function getCorners(shape: AsciiNodeShape, useAscii: boolean): CornerChars {
  const corners = SHAPE_CORNERS[shape] ?? SHAPE_CORNERS.rectangle
  return useAscii ? corners.ascii : corners.unicode
}
