import { useCallback } from "react"

/**
 * OSC 52 clipboard write — supported by modern terminals (iTerm2, Kitty,
 * Windows Terminal, Ghostty, Alacritty).
 */
function clipboardWrite(text: string): void {
  const encoded = Buffer.from(text).toString("base64")
  process.stdout.write(`\u001B]52;c;${encoded}\u0007`)
}

/**
 * Hook for copying text to the system clipboard via OSC 52 escape sequence.
 */
export function useClipboard(): { write: (text: string) => void } {
  const write = useCallback((text: string) => {
    clipboardWrite(text)
  }, [])

  return { write }
}
