import { slug, formatClock } from './text'
import { srtTime, vttTime, timeSubtitles } from './promptBuilder'
import { WORDS_PER_SECOND } from '../config/constants'

/** APPENDIX F — exports, and the Bengali caveats that come with them. */

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick — revoking synchronously cancels the download in
  // Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * F.3 Universal safety net. UTF-8 with a BOM so Windows Notepad renders Bengali
 * instead of mojibake. These two never break, which is why every export menu
 * offers them first.
 */
export function downloadText(text, filename) {
  download(new Blob([`﻿${text}`], { type: 'text/plain;charset=utf-8' }), filename)
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API needs a secure context and permission; fall back to the
    // old selection trick rather than losing the user's content.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand?.('copy') ?? false
    ta.remove()
    return ok
  }
}

// ── Plain text ──────────────────────────────────────────────────────────────

export function scriptToText(record) {
  const { script, config } = record
  const lines = [
    record.title,
    '='.repeat(Math.min(record.title.length, 60)),
    '',
    `Language: ${config.language}   Type: ${config.videoType}   Tone: ${config.tone}`,
    `Duration: ${config.durationSeconds}s   Products: ${(record.products ?? [])
      .map((p) => p.name)
      .join(', ')}`,
    '',
    'HOOK',
    script.hook,
    '',
  ]

  let elapsed = 0
  script.scenes.forEach((s, i) => {
    const start = elapsed
    elapsed += s.duration_seconds
    lines.push(
      `SCENE ${i + 1} — ${s.title}  (${formatClock(start)}–${formatClock(elapsed)}, ${s.duration_seconds}s)`,
      `  Voiceover: ${s.voiceover}`,
      `  On screen: ${s.on_screen_text}`,
      `  Visual:    ${s.visual_direction}`,
      `  Mood:      ${s.mood}   Transition: ${s.transition}`,
      '',
    )
  })

  lines.push('CALL TO ACTION', script.cta, '')

  if (script.hashtags?.length) lines.push(`Hashtags: ${script.hashtags.join(' ')}`, '')
  if (script.claims_used?.length)
    lines.push('Claims used (traceable to product data):', ...script.claims_used.map((c) => `  - ${c}`), '')

  return lines.join('\n')
}

export const exportAsTXT = (record) => downloadText(scriptToText(record), `${slug(record.title)}.txt`)

export const exportAsJSON = (record) =>
  download(
    new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' }),
    `${slug(record.title)}.json`,
  )

// ── F.1 DOCX — declare the font on every run ────────────────────────────────

const BN_FONT = 'Nirmala UI' // ships with Windows 8+
const EN_FONT = 'Calibri'

/**
 * The docx library does not embed fonts; it references them by name and Word
 * substitutes. Without a Bengali-capable font name on every run, Word renders
 * tofu boxes on machines that would otherwise be fine.
 */
export async function exportAsDOCX(record) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

  const lang = record.config.language === 'en' ? 'en' : 'bn'
  const font = lang === 'bn' ? BN_FONT : EN_FONT

  const run = (text, { bold = false, size = 22, italics = false, color } = {}) =>
    new TextRun({ text, bold, size, italics, color, font })

  // Latin-only labels ("SCENE 1") are safe in the Latin font; anything carrying
  // script content gets the Bengali-capable face.
  const label = (text, opts = {}) =>
    new TextRun({ text, bold: true, size: 20, font: EN_FONT, ...opts })

  let elapsed = 0
  const sceneParagraphs = record.script.scenes.flatMap((s, i) => {
    const start = elapsed
    elapsed += s.duration_seconds
    return [
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          label(`SCENE ${i + 1} — `),
          run(s.title, { bold: true }),
          label(`  (${formatClock(start)}–${formatClock(elapsed)} · ${s.duration_seconds}s)`, {
            bold: false,
            color: '767676',
          }),
        ],
      }),
      new Paragraph({ children: [label('Voiceover  '), run(s.voiceover)] }),
      new Paragraph({ children: [label('On screen  '), run(s.on_screen_text)] }),
      new Paragraph({
        children: [label('Visual  '), run(s.visual_direction, { size: 20, color: '5A5A5A' })],
      }),
    ]
  })

  const doc = new Document({
    styles: { default: { document: { run: { font, size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          new Paragraph({ text: record.title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              label(
                `${record.config.videoType} · ${record.config.tone} · ${record.config.durationSeconds}s · ${record.config.language}`,
                { bold: false, color: '767676' },
              ),
            ],
          }),

          new Paragraph({ spacing: { before: 120 }, children: [label('HOOK')] }),
          new Paragraph({ children: [run(record.script.hook)] }),

          ...sceneParagraphs,

          new Paragraph({ spacing: { before: 240 }, children: [label('CALL TO ACTION')] }),
          new Paragraph({ children: [run(record.script.cta)] }),

          ...(record.script.hashtags?.length
            ? [
                new Paragraph({
                  spacing: { before: 240 },
                  alignment: AlignmentType.LEFT,
                  children: [run(record.script.hashtags.join('  '), { size: 20, color: '767676' })],
                }),
              ]
            : []),
        ],
      },
    ],
  })

  download(await Packer.toBlob(doc), `${slug(record.title)}.docx`)
}

// ── F.2 PDF — English only, on purpose ─────────────────────────────────────

/**
 * jsPDF has zero Bengali coverage in its built-in fonts, and even with a TTF
 * embedded its text shaping does not do complex-script conjunct reordering —
 * Bengali যুক্তাক্ষর render wrong. Rather than ship subtly broken Bengali PDFs,
 * in-app PDF is restricted to English and the UI says so; the Bengali route is
 * DOCX → let Word produce the PDF.
 */
export const PDF_SUPPORTS_LANGUAGE = (language) => language === 'en'

export async function exportAsPDF(record) {
  if (!PDF_SUPPORTS_LANGUAGE(record.config.language)) {
    throw new Error(
      'In-app PDF export is English-only. For Bengali, export DOCX and save as PDF from Word — see README, Known limitations.',
    )
  }

  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const MARGIN = 48
  const WIDTH = doc.internal.pageSize.getWidth() - MARGIN * 2
  const BOTTOM = doc.internal.pageSize.getHeight() - MARGIN
  let y = MARGIN

  const write = (text, { size = 11, style = 'normal', gap = 6, color = [30, 30, 35] } = {}) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    for (const line of doc.splitTextToSize(text || '', WIDTH)) {
      if (y > BOTTOM) {
        doc.addPage()
        y = MARGIN
      }
      doc.text(line, MARGIN, y)
      y += size * 1.35
    }
    y += gap
  }

  write(record.title, { size: 20, style: 'bold', gap: 4 })
  write(
    `${record.config.videoType} · ${record.config.tone} · ${record.config.durationSeconds}s`,
    { size: 9, color: [120, 120, 130], gap: 14 },
  )

  write('HOOK', { size: 9, style: 'bold', gap: 2, color: [120, 120, 130] })
  write(record.script.hook, { gap: 14 })

  let elapsed = 0
  record.script.scenes.forEach((s, i) => {
    const start = elapsed
    elapsed += s.duration_seconds
    write(
      `SCENE ${i + 1} — ${s.title}  (${formatClock(start)}–${formatClock(elapsed)})`,
      { size: 9, style: 'bold', gap: 3, color: [120, 120, 130] },
    )
    write(s.voiceover, { gap: 3 })
    write(`On screen: ${s.on_screen_text}`, { size: 9, color: [90, 90, 100], gap: 3 })
    write(`Visual: ${s.visual_direction}`, { size: 9, color: [120, 120, 130], gap: 12 })
  })

  write('CALL TO ACTION', { size: 9, style: 'bold', gap: 2, color: [120, 120, 130] })
  write(record.script.cta)

  doc.save(`${slug(record.title)}.pdf`)
}

// ── Subtitles ──────────────────────────────────────────────────────────────

/** Falls back to one block per scene when the model-chunked blocks are absent. */
export function subtitleRows(record) {
  const wps = WORDS_PER_SECOND[record.config.language] ?? WORDS_PER_SECOND.en
  const blocks =
    record.subtitles?.blocks ??
    record.script.scenes.map((s, i) => ({ sceneIndex: i, text: s.voiceover }))
  return timeSubtitles(blocks, wps)
}

export function exportAsSRT(record) {
  const body = subtitleRows(record)
    .map((r) => `${r.index}\n${srtTime(r.start)} --> ${srtTime(r.end)}\n${r.text}\n`)
    .join('\n')
  downloadText(body, `${slug(record.title)}.srt`)
}

export function exportAsVTT(record) {
  const body = `WEBVTT\n\n${subtitleRows(record)
    .map((r) => `${r.index}\n${vttTime(r.start)} --> ${vttTime(r.end)}\n${r.text}\n`)
    .join('\n')}`
  downloadText(body, `${slug(record.title)}.vtt`)
}

// ── Shot list ──────────────────────────────────────────────────────────────

export function exportShotListCSV(record) {
  const shots = record.shots ?? []
  const cols = [
    'scene',
    'shot',
    'type',
    'angle',
    'movement',
    'subject',
    'props',
    'location',
    'broll',
    'notes',
  ]
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    cols.join(','),
    ...shots.map((s) => cols.map((c) => escape(s[c])).join(',')),
  ].join('\n')
  // BOM again — Excel on Windows needs it to read UTF-8 CSV correctly.
  download(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `${slug(record.title)}-shots.csv`)
}

// ── Backup file ────────────────────────────────────────────────────────────

export function downloadBackup(backup) {
  const stamp = new Date().toISOString().slice(0, 10)
  download(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }),
    `content-studio-backup-${stamp}.json`,
  )
}
