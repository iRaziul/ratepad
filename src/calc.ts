// src/calc.ts

export type Operator = '+' | '-' | '×' | '÷'

const OPERATORS = ['+', '-', '×', '÷'] as const

export function isOperator(char: string): char is Operator {
  return (OPERATORS as readonly string[]).includes(char)
}

export function normalizeOperator(char: string): Operator | null {
  if (char === '+' || char === 'add') return '+'
  if (char === '-' || char === '−' || char === 'sub') return '-'
  if (char === '*' || char === '×' || char === 'x' || char === 'X' || char === 'mul') return '×'
  if (char === '/' || char === '÷' || char === 'div') return '÷'
  return null
}

/**
 * Evaluates a mathematical expression safely with standard operator precedence.
 * Incomplete trailing operators or decimals are ignored so typing remains seamless.
 */
export function evaluateExpression(expr: string): number {
  if (!expr || !expr.trim()) return 0

  // Normalize operators
  const clean = expr
    .replace(/\*/g, '×')
    .replace(/\//g, '÷')
    .replace(/−/g, '-')
    .trim()

  // Tokenize numbers and operators
  const rawTokens = clean.split(/\s*([+×÷\-])\s*/).filter(t => t.length > 0)
  if (rawTokens.length === 0) return 0

  // Handle unary minus: ['-', '5', ...] -> ['-5', ...]
  const tokens: (number | Operator)[] = []
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i]
    if (token === '-' && (i === 0 || isOperator(rawTokens[i - 1]))) {
      const nextToken = rawTokens[i + 1]
      if (nextToken && !isOperator(nextToken)) {
        tokens.push(-Number(nextToken))
        i++
      }
    } else if (isOperator(token)) {
      tokens.push(token)
    } else {
      const num = Number(token)
      if (!isNaN(num)) {
        tokens.push(num)
      }
    }
  }

  // Drop incomplete trailing operators (e.g. "12 + ")
  while (tokens.length > 0 && typeof tokens[tokens.length - 1] === 'string') {
    tokens.pop()
  }

  if (tokens.length === 0) return 0
  if (tokens.length === 1) return typeof tokens[0] === 'number' ? tokens[0] : 0

  // Pass 1: Resolve high-precedence operators (×, ÷)
  const step1: (number | '+' | '-')[] = []
  let i = 0
  while (i < tokens.length) {
    const current = tokens[i]
    if (current === '×' || current === '÷') {
      const prev = step1.pop()
      const next = tokens[i + 1]
      if (typeof prev === 'number' && typeof next === 'number') {
        let res = 0
        if (current === '×') {
          res = prev * next
        } else {
          res = next !== 0 ? prev / next : prev
        }
        step1.push(Math.round(res * 1e10) / 1e10)
        i += 2
        continue
      }
    }
    step1.push(current as number | '+' | '-')
    i++
  }

  // Pass 2: Resolve low-precedence operators (+, -)
  if (step1.length === 0) return 0
  let result = typeof step1[0] === 'number' ? step1[0] : 0

  for (let j = 1; j < step1.length; j += 2) {
    const op = step1[j]
    const next = step1[j + 1]
    if (typeof next === 'number') {
      if (op === '+') {
        result += next
      } else if (op === '-') {
        result -= next
      }
      result = Math.round(result * 1e10) / 1e10
    }
  }

  return isNaN(result) ? 0 : result
}

/**
 * Checks if the expression contains calculation operators
 */
export function hasCalculation(expr: string): boolean {
  if (!expr) return false
  const clean = expr.replace(/^[−\-]/, '') // Ignore leading negative
  return /[+×÷\-\*\/]/.test(clean)
}

/**
 * Formats expression numbers with locale commas while preserving operators and active decimals
 */
export function formatExpression(expr: string): string {
  if (!expr) return '0'

  const tokens = expr.split(/(\s+[+×÷\-]\s+)/)
  return tokens
    .map(token => {
      const trimmed = token.trim()
      if (isOperator(trimmed)) {
        return ` ${trimmed} `
      }
      if (!trimmed) return ''

      const isNegative = trimmed.startsWith('-') || trimmed.startsWith('−')
      const unsigned = isNegative ? trimmed.slice(1) : trimmed

      if (unsigned.includes('.')) {
        const parts = unsigned.split('.')
        const intFormatted = parts[0] ? Number(parts[0]).toLocaleString('en-US') : '0'
        const decPart = parts.slice(1).join('.')
        return `${isNegative ? '-' : ''}${intFormatted}.${decPart}`
      }

      if (unsigned.length > 0 && !isNaN(Number(unsigned))) {
        return `${isNegative ? '-' : ''}${Number(unsigned).toLocaleString('en-US')}`
      }

      return token
    })
    .join('')
}

/**
 * Gets the current active number segment being typed
 */
function getLastNumberSegment(expr: string): string {
  const parts = expr.split(/\s+[+×÷\-]\s+/)
  return parts[parts.length - 1] ?? ''
}

/**
 * Appends a digit, decimal, or operator to the current expression
 */
export function appendInput(current: string, char: string): string {
  const normOp = normalizeOperator(char)

  if (normOp) {
    if (!current) {
      if (normOp === '-') return '-'
      return `0 ${normOp} `
    }

    if (current === '-') {
      if (normOp === '-') return current
      return ''
    }

    // If currently ends with an operator (e.g. "12 + ") -> replace with new operator
    if (/\s+[+×÷\-]\s+$/.test(current)) {
      return current.replace(/\s+[+×÷\-]\s+$/, ` ${normOp} `)
    }

    // If ends with trailing dot -> strip dot first
    const trimmed = current.endsWith('.') ? current.slice(0, -1) : current
    return `${trimmed} ${normOp} `
  }

  if (char === '.') {
    if (!current || /\s+[+×÷\-]\s+$/.test(current)) {
      return `${current}0.`
    }
    const lastSegment = getLastNumberSegment(current)
    if (lastSegment.includes('.')) {
      return current
    }
    return `${current}.`
  }

  // Digit handling ('0'-'9')
  if (char >= '0' && char <= '9') {
    if (current === '0') {
      return char === '0' ? '0' : char
    }

    const lastSegment = getLastNumberSegment(current)

    // Prevent multiple leading zeroes like "10 + 00"
    if (lastSegment === '0') {
      if (char === '0') return current
      // Replace lone zero with new digit
      return current.slice(0, -1) + char
    }

    // Limit decimal precision to 4 decimal places per segment
    if (lastSegment.includes('.')) {
      const decPart = lastSegment.split('.')[1]
      if (decPart && decPart.length >= 4) return current
    }

    // Limit integer length per segment
    if (!lastSegment.includes('.') && lastSegment.replace(/^[−\-]/, '').length >= 10) {
      return current
    }

    return current + char
  }

  return current
}

/**
 * Handles backspace on expression strings
 */
export function backspaceInput(current: string): string {
  if (!current) return ''

  // If ends with an operator (e.g. " + " or " +")
  if (/\s*[+×÷\-]\s*$/.test(current)) {
    return current.replace(/\s*[+×÷\-]\s*$/, '')
  }

  const sliced = current.slice(0, -1)
  return sliced.trimEnd()
}

/**
 * Evaluates the expression and collapses it into a single clean number string
 */
export function collapseExpression(expr: string): string {
  if (!hasCalculation(expr)) return expr
  const result = evaluateExpression(expr)
  const rounded = Math.round(result * 1e6) / 1e6
  return String(rounded)
}
