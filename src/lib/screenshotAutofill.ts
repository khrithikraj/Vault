import { recognize } from 'tesseract.js'
import type { FieldDefinition } from '../types/app'

export type ScreenshotExtraction = {
  signature: string
  rawText: string
  lines: string[]
  confidence: number
}

export type ScreenshotAutofill = {
  values: Record<string, string>
  matchedFields: string[]
}

function cleanupCandidate(text: string) {
  return text.replace(/\s+/g, ' ').replace(/^[-•·|]+/, '').replace(/[-•·|]+$/, '').trim()
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>()
  const next: string[] = []

  for (const line of lines) {
    const normalized = cleanupCandidate(line)
    if (!normalized) {
      continue
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push(normalized)
  }

  return next
}

function isNoiseLine(line: string) {
  const normalized = line.trim()
  return !normalized || /^[\W_]+$/.test(normalized)
}

function looksLikeAddress(line: string) {
  return (
    /\b(?:\d{1,5}\s+)?(?:[A-Za-z0-9]+\s+){0,4}(?:road|rd|street|st|lane|ln|avenue|ave|drive|dr|block|sector|phase|market|mall|town|city|district|nagar|colony|building|bldg|floor|opp|near|behind|beside|pin|pincode|zip)\b/i.test(
      line,
    ) || /\d{5,6}/.test(line) || /,/.test(line)
  )
}

function looksLikeUrl(line: string) {
  return /https?:\/\/|\bwww\./i.test(line)
}

function looksLikePrice(line: string) {
  return /(?:₹|rs\.?|inr|\$)\s*\d+[\d,]*(?:\.\d+)?/i.test(line) || /\b\d+[\d,]*(?:\.\d+)?\b/.test(line)
}

function looksLikeDish(line: string) {
  return /\b(?:must\s*try|try|order|special|signature|recommended|recommend|dish|item)\b/i.test(line)
}

function findUrl(lines: string[], rawText: string) {
  const textUrl = rawText.match(/https?:\/\/[^\s)\]]+/i)?.[0]
  if (textUrl) {
    return textUrl
  }
  return lines.find(looksLikeUrl) ?? ''
}

function findPrice(lines: string[]) {
  const line = lines.find(looksLikePrice)
  if (!line) {
    return ''
  }

  const currencyMatch = line.match(/(?:₹|rs\.?|inr|\$)\s*\d+[\d,]*(?:\.\d+)?/i)
  return cleanupCandidate(currencyMatch?.[0] ?? line)
}

function findAddress(lines: string[]) {
  const index = lines.findIndex(looksLikeAddress)
  if (index === -1) {
    return ''
  }

  const first = cleanupCandidate(lines[index])
  const second = lines[index + 1] && looksLikeAddress(lines[index + 1]) ? cleanupCandidate(lines[index + 1]) : ''
  return [first, second].filter(Boolean).join(', ')
}

function findDish(lines: string[]) {
  const direct = lines.find(looksLikeDish)
  if (direct) {
    const afterColon = direct.split(/[:\-–—]/).slice(1).join(':').trim()
    return cleanupCandidate(afterColon || direct)
  }

  const ordered = lines.find((line) => /\b(?:what to try|what to eat|best to order|top pick|signature)\b/i.test(line))
  if (ordered) {
    return cleanupCandidate(ordered)
  }

  return ''
}

function findTitle(lines: string[], usedValues: string[]) {
  const used = new Set(usedValues.map((value) => value.toLowerCase()))

  const candidate = lines.find((line) => {
    if (isNoiseLine(line)) {
      return false
    }
    if (used.has(line.toLowerCase())) {
      return false
    }
    if (looksLikeAddress(line) || looksLikeUrl(line) || looksLikePrice(line) || looksLikeDish(line)) {
      return false
    }
    if (/\b(?:follow|subscribe|save|share|reel|original audio|instagram|watch now|link in bio)\b/i.test(line)) {
      return false
    }
    return line.length >= 2 && line.length <= 80
  })

  return candidate ? cleanupCandidate(candidate) : ''
}

function findNotes(lines: string[], usedValues: string[]) {
  const used = new Set(usedValues.map((value) => value.toLowerCase()))
  const leftovers = lines.filter((line) => !used.has(line.toLowerCase()) && !isNoiseLine(line))
  return leftovers.slice(0, 5).join('\n').trim()
}

function inferValueForField(field: FieldDefinition, lines: string[], rawText: string, usedValues: string[]) {
  const fieldKey = `${field.key} ${field.label}`.toLowerCase()

  if (/(^|\b)(title|name|place|spot|restaurant|cafe|hotel|shop|store|location)(\b|$)/i.test(fieldKey)) {
    return findTitle(lines, usedValues)
  }

  if (/(address|venue|area|branch|city|pin|pincode|near|location)/i.test(fieldKey)) {
    return findAddress(lines)
  }

  if (/(dish|must\s*try|must-try|special|order|recommend|food|item)/i.test(fieldKey)) {
    return findDish(lines)
  }

  if (/(price|cost|amount|budget|fee|ticket)/i.test(fieldKey) || field.type === 'currency') {
    return findPrice(lines)
  }

  if (field.type === 'url' || /(link|url|source|instagram|reel)/i.test(fieldKey)) {
    return findUrl(lines, rawText)
  }

  if (/(notes|description|details|comment)/i.test(fieldKey) || field.type === 'textarea') {
    return findNotes(lines, usedValues)
  }

  return ''
}

export async function extractScreenshotText(file: File): Promise<ScreenshotExtraction> {
  const signature = `${file.name}:${file.size}:${file.lastModified}`
  const result = await recognize(file, 'eng')
  const rawText = cleanupCandidate(result.data.text || '')
  const lines = uniqueLines(
    rawText
      .split(/\r?\n+/)
      .map((line) => cleanupCandidate(line))
      .filter(Boolean),
  )

  return {
    signature,
    rawText,
    lines,
    confidence: result.data.confidence ?? 0,
  }
}

export function buildScreenshotAutofill(extraction: ScreenshotExtraction, fields: FieldDefinition[]): ScreenshotAutofill {
  const values: Record<string, string> = {}
  const matchedFields: string[] = []
  const usedValues: string[] = []

  for (const field of fields) {
    const value = inferValueForField(field, extraction.lines, extraction.rawText, usedValues)
    if (!value || values[field.key]) {
      continue
    }

    values[field.key] = value
    matchedFields.push(field.label)
    usedValues.push(value)
  }

  return { values, matchedFields }
}