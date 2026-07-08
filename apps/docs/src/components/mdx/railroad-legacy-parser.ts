import {
  choice,
  comment,
  diagram,
  end,
  group,
  nonTerminal,
  oneOrMore,
  optional,
  sequence,
  skip,
  special,
  start,
  terminal,
} from "@choo-choo/core"
import type { Diagram, End, Node, Start } from "@choo-choo/core"
import {
  GrammarSyntaxError,
  Reader,
  Specification,
  Tokenizer,
} from "@choo-choo/parser-utils"
import type { Token } from "@choo-choo/parser-utils"

type LegacyTokenType =
  | "identifier"
  | "string"
  | "number"
  | "lparen"
  | "rparen"
  | "lbrace"
  | "rbrace"
  | "comma"
  | "colon"

type LegacyExpression =
  | { kind: "call"; name: string; args: LegacyExpression[]; token: LegacyToken }
  | { kind: "string"; value: string; token: LegacyToken }
  | { kind: "number"; value: number; token: LegacyToken }
  | { kind: "identifier"; value: string; token: LegacyToken }
  | { kind: "object"; value: Record<string, LegacyScalar>; token: LegacyToken }

type LegacyScalar = string | number

type LegacyToken = Token<LegacyTokenType>
type LegacyCall = Extract<LegacyExpression, { kind: "call" }>

const tokenSpecification = new Specification<LegacyTokenType>()
  .add(/^\s+/u, null)
  .add(/^\(/u, "lparen")
  .add(/^\)/u, "rparen")
  .add(/^\{/u, "lbrace")
  .add(/^\}/u, "rbrace")
  .add(/^,/u, "comma")
  .add(/^:/u, "colon")
  .add(/^-?\d+/u, "number")
  .add(/^"(?:\\.|[^"\\])*"/u, "string")
  .add(/^'(?:\\.|[^'\\])*'/u, "string")
  .add(/^[A-Za-z_][A-Za-z0-9_-]*/u, "identifier")

class LegacyDslParser {
  private readonly tokens: LegacyToken[]
  private index = 0

  constructor(source: string) {
    this.tokens = LegacyDslParser.tokenize(source)
  }

  parseRootCall(): LegacyExpression {
    const expression = this.parseExpression()

    if (expression.kind !== "call") {
      throw this.syntaxError(
        "legacy syntax must start with a function call",
        expression.token
      )
    }

    if (!this.isAtEnd()) {
      throw this.syntaxError("unexpected trailing tokens", this.peek())
    }

    return expression
  }

  private static tokenize(source: string): LegacyToken[] {
    const reader = new Reader(source)
    const tokenizer = new Tokenizer(reader, tokenSpecification)
    const tokens: LegacyToken[] = []

    while (true) {
      const token = tokenizer.next()
      if (token === null) {
        break
      }
      tokens.push(token)
    }

    return tokens
  }

  private parseExpression(): LegacyExpression {
    const token = this.peek()

    if (!token) {
      throw this.syntaxError("unexpected end of input")
    }

    if (token.type === "string") {
      this.index += 1
      return {
        kind: "string",
        value: LegacyDslParser.decodeString(token.value),
        token,
      }
    }

    if (token.type === "number") {
      this.index += 1
      return {
        kind: "number",
        value: Math.trunc(Number(token.value)),
        token,
      }
    }

    if (token.type === "identifier") {
      this.index += 1
      const identifierToken = token

      if (this.match("lparen")) {
        const args = this.parseArguments("rparen")
        this.consume(
          "rparen",
          `expected ) after arguments of ${identifierToken.value}`
        )
        return {
          kind: "call",
          name: identifierToken.value,
          args,
          token: identifierToken,
        }
      }

      return {
        kind: "identifier",
        value: identifierToken.value,
        token: identifierToken,
      }
    }

    if (this.match("lbrace")) {
      return this.parseObject(token)
    }

    throw this.syntaxError(`unexpected token ${token.value}`, token)
  }

  private parseObject(openBraceToken: LegacyToken): LegacyExpression {
    const value: Record<string, LegacyScalar> = {}

    if (this.match("rbrace")) {
      return { kind: "object", value, token: openBraceToken }
    }

    while (!this.isAtEnd()) {
      const key = this.consume("identifier", "expected object key")
      this.consume("colon", `expected : after object key ${key.value}`)

      const parsedValue = this.parseExpression()
      if (
        parsedValue.kind !== "string" &&
        parsedValue.kind !== "number" &&
        parsedValue.kind !== "identifier"
      ) {
        throw this.syntaxError(
          "object values must be string, number, or identifier",
          parsedValue.token
        )
      }

      value[key.value] =
        parsedValue.kind === "number"
          ? parsedValue.value
          : parsedValue.kind === "identifier"
            ? parsedValue.value
            : parsedValue.value

      if (this.match("comma")) {
        continue
      }

      break
    }

    this.consume("rbrace", "expected } after object literal")
    return { kind: "object", value, token: openBraceToken }
  }

  private parseArguments(terminator: LegacyTokenType): LegacyExpression[] {
    const args: LegacyExpression[] = []

    if (this.check(terminator)) {
      return args
    }

    while (!this.isAtEnd()) {
      args.push(this.parseExpression())

      if (!this.match("comma")) {
        break
      }
    }

    return args
  }

  private static decodeString(raw: string): string {
    const [quote] = raw

    if (quote === '"') {
      try {
        return JSON.parse(raw)
      } catch {
        return raw.slice(1, -1)
      }
    }

    const body = raw.slice(1, -1)
    return body.replaceAll(
      /\\(?<escaped>[\\'"nrtb])/gu,
      (_match, escaped: string) => {
        if (escaped === "n") {
          return "\n"
        }
        if (escaped === "r") {
          return "\r"
        }
        if (escaped === "t") {
          return "\t"
        }
        if (escaped === "b") {
          return "\b"
        }
        return escaped
      }
    )
  }

  private peek(): LegacyToken | null {
    return this.tokens[this.index] ?? null
  }

  private consume(type: LegacyTokenType, message: string): LegacyToken {
    const token = this.peek()

    if (!token || token.type !== type) {
      throw this.syntaxError(message, token)
    }

    this.index += 1
    return token
  }

  private check(type: LegacyTokenType): boolean {
    const token = this.peek()
    return token?.type === type
  }

  private match(type: LegacyTokenType): boolean {
    if (this.check(type)) {
      this.index += 1
      return true
    }

    return false
  }

  private isAtEnd(): boolean {
    return this.index >= this.tokens.length
  }

  private syntaxError(
    message: string,
    token?: LegacyToken | null
  ): GrammarSyntaxError {
    const position = token?.source.start ??
      this.tokens.at(-1)?.source.end ?? {
        offset: 0,
        line: 1,
        column: 1,
      }
    return new GrammarSyntaxError(message, position)
  }
}

function isCallNamed(
  expression: LegacyExpression,
  name: string
): expression is LegacyCall {
  return (
    expression.kind === "call" &&
    expression.name.toLowerCase() === name.toLowerCase()
  )
}

function scalarFromExpression(
  expression: LegacyExpression,
  context: string
): LegacyScalar {
  if (expression.kind === "string" || expression.kind === "number") {
    return expression.value
  }

  if (expression.kind === "identifier") {
    return expression.value
  }

  throw new Error(`${context} expects string/number/identifier`)
}

function textFromExpression(
  expression: LegacyExpression,
  context: string
): string {
  return String(scalarFromExpression(expression, context))
}

function skipPositionFromExpression(
  expression: LegacyExpression | undefined
): "top" | "bottom" {
  if (!expression) {
    return "top"
  }

  const raw = String(
    scalarFromExpression(expression, "skip position")
  ).toLowerCase()
  if (raw === "bottom") {
    return "bottom"
  }
  if (raw === "top") {
    return "top"
  }
  if (raw === "skip") {
    return "bottom"
  }
  return "top"
}

function metadataFromExpression(
  expression: LegacyExpression | undefined
): { href?: string; title?: string } | undefined {
  if (!expression) {
    return undefined
  }

  if (expression.kind !== "object") {
    return undefined
  }

  const { href } = expression.value
  const { title } = expression.value

  const metadata: { href?: string; title?: string } = {}
  if (typeof href === "string") {
    metadata.href = href
  }
  if (typeof title === "string") {
    metadata.title = title
  }

  return metadata.href || metadata.title ? metadata : undefined
}

function nodeFromExpression(expression: LegacyExpression): Node {
  if (expression.kind === "string") {
    return terminal(expression.value)
  }

  if (expression.kind === "number") {
    return terminal(String(expression.value))
  }

  if (expression.kind === "identifier") {
    return nonTerminal(expression.value)
  }

  if (expression.kind === "object") {
    throw new Error("object literals are only supported as function options")
  }

  return nodeFromCall(expression)
}

function startFromCall(call: LegacyCall): Start {
  const [variantArg, labelArg] = call.args

  if (variantArg?.kind === "object") {
    const typeFromObject = variantArg.value.type
    const labelFromObject = variantArg.value.label
    const variant =
      typeof typeFromObject === "string" &&
      typeFromObject.toLowerCase() === "complex"
        ? "complex"
        : "simple"
    const label =
      typeof labelFromObject === "string" ? labelFromObject : undefined
    return start(variant, label)
  }

  const variantRaw = variantArg
    ? textFromExpression(variantArg, "Start variant")
    : "simple"
  const variant = variantRaw.toLowerCase() === "complex" ? "complex" : "simple"
  const label = labelArg
    ? textFromExpression(labelArg, "Start label")
    : undefined
  return start(variant, label)
}

function endFromCall(call: LegacyCall): End {
  const [variantArg] = call.args

  if (variantArg?.kind === "object") {
    const typeFromObject = variantArg.value.type
    const variant =
      typeof typeFromObject === "string" &&
      typeFromObject.toLowerCase() === "complex"
        ? "complex"
        : "simple"
    return end(variant)
  }

  const variantRaw = variantArg
    ? textFromExpression(variantArg, "End variant")
    : "simple"
  const variant = variantRaw.toLowerCase() === "complex" ? "complex" : "simple"
  return end(variant)
}

function defaultStringExpression(token: LegacyToken): LegacyExpression {
  return { kind: "string", value: "", token }
}

function readChoiceArguments(call: LegacyCall): {
  normal: number
  children: Node[]
} {
  let normal = 0
  let firstNodeIndex = 0

  if (call.args[0]?.kind === "number") {
    normal = call.args[0].value
    firstNodeIndex = 1
  }

  const children = call.args.slice(firstNodeIndex).map(nodeFromExpression)
  return { normal, children }
}

function handleChoice(call: LegacyCall): Node {
  const { normal, children } = readChoiceArguments(call)
  return choice({ normal }, ...children)
}

function handleMultipleChoice(call: LegacyCall): Node {
  let firstNodeIndex = call.args[0]?.kind === "number" ? 1 : 0
  const normal = call.args[0]?.kind === "number" ? call.args[0].value : 0
  const maybeTypeToken = call.args[firstNodeIndex]

  if (
    maybeTypeToken &&
    (maybeTypeToken.kind === "string" || maybeTypeToken.kind === "identifier")
  ) {
    firstNodeIndex += 1
  }

  const children = call.args.slice(firstNodeIndex).map(nodeFromExpression)
  return choice({ normal }, ...children)
}

function handleOptional(call: LegacyCall): Node {
  const child = nodeFromExpression(
    call.args[0] ?? defaultStringExpression(call.token)
  )
  const skipPos = skipPositionFromExpression(call.args[1])
  return optional(child, skipPos)
}

function handleOneOrMore(call: LegacyCall): Node {
  const child = nodeFromExpression(
    call.args[0] ?? defaultStringExpression(call.token)
  )
  const separator = call.args[1] ? nodeFromExpression(call.args[1]) : undefined
  return oneOrMore(child, separator)
}

function handleZeroOrMore(call: LegacyCall): Node {
  const child = nodeFromExpression(
    call.args[0] ?? defaultStringExpression(call.token)
  )
  const separator = call.args[1] ? nodeFromExpression(call.args[1]) : undefined
  const skipPos = skipPositionFromExpression(call.args[2])
  return optional(oneOrMore(child, separator), skipPos)
}

function handleLeaf(
  call: LegacyCall,
  context: "Terminal" | "NonTerminal" | "Special" | "Comment"
): string {
  return textFromExpression(
    call.args[0] ?? defaultStringExpression(call.token),
    context
  )
}

const callHandlers: Record<string, (call: LegacyCall) => Node> = {
  sequence: (call) => sequence(...call.args.map(nodeFromExpression)),
  stack: (call) => sequence(...call.args.map(nodeFromExpression)),
  choice: handleChoice,
  horizontalchoice: handleChoice,
  multiplechoice: handleMultipleChoice,
  optional: handleOptional,
  oneormore: handleOneOrMore,
  zeroormore: handleZeroOrMore,
  optionalsequence: (call) =>
    sequence(
      ...call.args.map((arg) => optional(nodeFromExpression(arg), "top"))
    ),
  alternatingsequence: (call) => sequence(...call.args.map(nodeFromExpression)),
  terminal: (call) =>
    terminal(
      handleLeaf(call, "Terminal"),
      metadataFromExpression(call.args[1])
    ),
  nonterminal: (call) =>
    nonTerminal(
      handleLeaf(call, "NonTerminal"),
      metadataFromExpression(call.args[1])
    ),
  special: (call) =>
    special(handleLeaf(call, "Special"), metadataFromExpression(call.args[1])),
  comment: (call) =>
    comment(handleLeaf(call, "Comment"), metadataFromExpression(call.args[1])),
  group: (call) => {
    const child = nodeFromExpression(
      call.args[0] ?? defaultStringExpression(call.token)
    )
    const label = call.args[1]
      ? textFromExpression(call.args[1], "Group label")
      : undefined
    return group(child, label)
  },
  skip: () => skip(),
}

function nodeFromCall(call: LegacyCall): Node {
  const name = call.name.toLowerCase()
  const handler = callHandlers[name]

  if (handler) {
    return handler(call)
  }

  if (
    name === "start" ||
    name === "end" ||
    name === "diagram" ||
    name === "complexdiagram"
  ) {
    throw new Error(`${call.name} can only be used at top-level`)
  }

  // Fallback for unknown constructors: interpret as a named non-terminal with optional sequence payload.
  if (call.args.length === 0) {
    return nonTerminal(call.name)
  }

  return group(sequence(...call.args.map(nodeFromExpression)), call.name)
}

function diagramFromRoot(call: LegacyCall): Diagram {
  const isComplex = call.name.toLowerCase() === "complexdiagram"
  if (!isComplex && call.name.toLowerCase() !== "diagram") {
    throw new Error(
      `legacy root must be Diagram(...) or ComplexDiagram(...), received ${call.name}`
    )
  }

  let startOption: Start | undefined = isComplex ? start("complex") : undefined
  let endOption: End | undefined = isComplex ? end("complex") : undefined
  const children: Node[] = []

  for (const arg of call.args) {
    if (isCallNamed(arg, "start")) {
      startOption = startFromCall(arg)
      continue
    }

    if (isCallNamed(arg, "end")) {
      endOption = endFromCall(arg)
      continue
    }

    children.push(nodeFromExpression(arg))
  }

  if (children.length === 0) {
    throw new Error("Diagram requires at least one child node")
  }

  const [firstChild] = children
  if (!firstChild) {
    throw new Error("Diagram requires at least one child node")
  }

  const child = children.length === 1 ? firstChild : sequence(...children)
  const options =
    startOption || endOption
      ? { start: startOption, end: endOption }
      : undefined

  return diagram(child, options)
}

export function looksLikeLegacyRailroad(source: string): boolean {
  return /^\s*(?<diagramType>Diagram|ComplexDiagram)\s*\(/u.test(source)
}

export function parseLegacyRailroadDiagram(source: string): Diagram {
  const parser = new LegacyDslParser(source)
  const expression = parser.parseRootCall()

  if (expression.kind !== "call") {
    throw new Error(
      "legacy syntax must start with Diagram(...) or ComplexDiagram(...)"
    )
  }

  return diagramFromRoot(expression)
}
