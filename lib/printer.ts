import os from 'os'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type PrintOrderItem = {
  name: string
  quantity: number
  modifiers?: string[]
}

export type PrintOrderData = {
  id: string | number
  dailyNumber?: string | null
  orderType?: string
  phone_number?: string
  customer_name?: string
  table_number?: string
  timestamp?: string | Date
  items: PrintOrderItem[]
  total?: number | string
}

export type PrinterConfig = {
  name?: string
}

function pickWish(raw: string | undefined, key: string): string {
  const fallback = 'Tegul kiekvienas kasnis dziugina!'
  const src = (raw ?? fallback).trim()
  if (!src) return fallback

  const parts = src
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length <= 1) return parts[0] ?? fallback

  let h = 0
  const k = String(key)
  for (let i = 0; i < k.length; i++) {
    h = ((h << 5) - h + k.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % parts.length
  return parts[idx] ?? fallback
}

export type PrintResult = {
  success: boolean
  method: string
  errors?: Record<string, string>
}

export function getPrinterConfig(): PrinterConfig {
  return {
    name: process.env.PRINTER_NAME || undefined,
  }
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalizeDate(ts: PrintOrderData['timestamp']): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function transliterateCyrillicToLatin(input: string): string {
  const map: Record<string, string> = {
    А: 'A', Б: 'B', В: 'V', Г: 'H', Ґ: 'G', Д: 'D', Е: 'E', Є: 'Ye', Ж: 'Zh', З: 'Z', И: 'Y', І: 'I', Ї: 'Yi', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'Kh', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Shch', Ю: 'Yu', Я: 'Ya', Ь: '', Ъ: '',
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ю: 'yu', я: 'ya', ь: '', ъ: '',
    Э: 'E', Ы: 'Y', Ё: 'Yo', э: 'e', ы: 'y', ё: 'yo',
  }
  let out = ''
  for (const ch of input) {
    out += map[ch] ?? ch
  }
  return out
}

function normalizeForEscPos(input: string): string {
  const forceLatin = process.env.PRINTER_FORCE_LATIN === '1'
  const base = forceLatin ? transliterateCyrillicToLatin(input) : input
  const normalized = base
    .replaceAll('ą', 'a')
    .replaceAll('č', 'c')
    .replaceAll('ę', 'e')
    .replaceAll('ė', 'e')
    .replaceAll('į', 'i')
    .replaceAll('š', 's')
    .replaceAll('ų', 'u')
    .replaceAll('ū', 'u')
    .replaceAll('ž', 'z')
    .replaceAll('Ą', 'A')
    .replaceAll('Č', 'C')
    .replaceAll('Ę', 'E')
    .replaceAll('Ė', 'E')
    .replaceAll('Į', 'I')
    .replaceAll('Š', 'S')
    .replaceAll('Ų', 'U')
    .replaceAll('Ū', 'U')
    .replaceAll('Ž', 'Z')

  if (!forceLatin) return normalized

  let out = ''
  for (const ch of normalized) {
    const code = ch.charCodeAt(0)
    if (code === 9 || code === 10 || code === 13) {
      out += ' '
      continue
    }
    if (code >= 32 && code <= 126) {
      out += ch
      continue
    }
    out += ' '
  }
  return out.replace(/\s+/g, ' ').trimEnd()
}

export function buildTicketHtml(order: PrintOrderData): string {
  const id = String(order.dailyNumber ?? order.id)
  const dateStr = normalizeDate(order.timestamp).toLocaleString('lt-LT')
  const wish = pickWish(process.env.PRINTER_WISH, id)

  const itemsHtml = (order.items || [])
    .map((item) => {
      const mods = (item.modifiers || [])
        .filter(Boolean)
        .map((m) => `<div class="modifier">+ ${escapeHtml(String(m))}</div>`)
        .join('')

      return `
        <div class="item-row">
          <div class="item-name">${escapeHtml(String(item.name))}</div>
          <div class="item-qty">x${escapeHtml(String(item.quantity))}</div>
        </div>
        ${mods}
      `
    })
    .join('')

  const orderType = order.orderType ? `<div class="info">${escapeHtml(order.orderType)}</div>` : ''
  const phone = order.phone_number ? `<div class="info">Tel: ${escapeHtml(order.phone_number)}</div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Order ${escapeHtml(id)}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 58mm;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      padding: 3mm;
      color: #000;
    }
    .logo { text-align: center; font-weight: 700; font-size: 14px; margin-bottom: 2mm; }
    .order-id {
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      border: 2px solid #000;
      padding: 2mm;
      margin: 3mm 0;
    }
    .info { text-align: center; font-size: 11px; margin: 1mm 0; }
    .divider { border-top: 1px dashed #000; margin: 3mm 0; }
    .item-row {
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      margin: 1.5mm 0;
    }
    .item-name { flex: 1 1 auto; overflow-wrap: anywhere; }
    .item-qty { flex: 0 0 auto; font-weight: 700; }
    .modifier { margin-left: 4mm; font-size: 10px; color: #333; margin-top: 0.5mm; }
    .footer { text-align: center; font-size: 9px; margin-top: 3mm; }
  </style>
</head>
<body>
  <div class="logo">MEIDA</div>
  <div class="order-id">#${escapeHtml(id)}</div>
  ${orderType}
  ${phone}
  <div class="info">${escapeHtml(dateStr)}</div>
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="footer">${escapeHtml(wish)}</div>
  <div class="footer">Ačiū kad renkatės mus!</div>
</body>
</html>`
}

function buildTextTicket(order: PrintOrderData): string {
  const id = String(order.dailyNumber ?? order.id)
  const dateStr = normalizeDate(order.timestamp).toLocaleString('lt-LT')
  const wish = pickWish(process.env.PRINTER_WISH, id)

  const lines: string[] = []
  lines.push('MEIDA')
  lines.push(normalizeForEscPos(`ORDER #${id}`))
  if (order.orderType) lines.push(normalizeForEscPos(String(order.orderType)))
  if (order.phone_number) lines.push(normalizeForEscPos(`Tel: ${order.phone_number}`))
  lines.push(normalizeForEscPos(dateStr))
  lines.push('--------------------------------')

  for (const it of order.items || []) {
    const name = normalizeForEscPos(String(it.name || ''))
    lines.push(name)
    lines.push(normalizeForEscPos(`x${it.quantity}`))
    for (const m of it.modifiers || []) {
      lines.push(normalizeForEscPos(`  + ${String(m)}`))
    }
  }

  lines.push('--------------------------------')
  lines.push(normalizeForEscPos(wish))
  lines.push(normalizeForEscPos('Ačiū kad renkatės mus!'))
  return lines.join('\r\n')
}

async function printTextViaNotepad(txtFile: string): Promise<void> {
  await execFileAsync('notepad.exe', ['/p', txtFile], { timeout: 30000 })
}

async function printEscPosViaWinspool(order: PrintOrderData, printerName: string): Promise<void> {
  const forceLatin = process.env.PRINTER_FORCE_LATIN === '1'
  const encoding = forceLatin ? 'us-ascii' : (process.env.PRINTER_ENCODING || '866')
  const escT = forceLatin ? '' : (process.env.PRINTER_ESC_T || '17')
  const footer = normalizeForEscPos('Ačiū už pirkimą!')
  const normalizedPhone = order.phone_number ? normalizeForEscPos(order.phone_number) : ''
  const orderJson = JSON.stringify({
    id: order.id,
    orderType: order.orderType,
    phone_number: order.phone_number,
    normalizedPhone: normalizedPhone,
    customer_name: order.customer_name,
    table_number: order.table_number,
    timestamp: order.timestamp,
    items: order.items.map(it => ({
      name: normalizeForEscPos(it.name),
      quantity: it.quantity,
      modifiers: (it.modifiers || []).map(m => normalizeForEscPos(m))
    }))
  }).replaceAll("'", "''")

  const ps = `
$printerName = '${printerName.replaceAll("'", "''")}'
$order = ConvertFrom-Json '${orderJson}'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFOA di);

  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void SendBytes(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
    }

    try {
      var di = new DOCINFOA();
      di.pDocName = "POS Ticket";
      di.pDataType = "RAW";

      if (!StartDocPrinter(hPrinter, 1, di)) {
        throw new Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
      }

      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new Exception("StartPagePrinter failed: " + Marshal.GetLastWin32Error());
        }

        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
          int dwWritten = 0;
          if (!WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten)) {
            throw new Exception("WritePrinter failed: " + Marshal.GetLastWin32Error());
          }
        } finally {
          Marshal.FreeCoTaskMem(pUnmanagedBytes);
        }

        if (!EndPagePrinter(hPrinter)) {
          throw new Exception("EndPagePrinter failed: " + Marshal.GetLastWin32Error());
        }
      } finally {
        if (!EndDocPrinter(hPrinter)) {
          throw new Exception("EndDocPrinter failed: " + Marshal.GetLastWin32Error());
        }
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
'@

$enc = [System.Text.Encoding]::GetEncoding(${encoding.match(/^\d+$/) ? encoding : `'${encoding.replaceAll("'", "''")}'`})

$b = New-Object System.Collections.Generic.List[byte]
function AddBytes([byte[]]$arr) { $b.AddRange($arr) | Out-Null }
function AddText([string]$s) { if ($null -eq $s) { return }; AddBytes($enc.GetBytes($s)) }
function LF { AddBytes([byte[]](0x0A)) }
function Divider { AddText('--------------------------------'); LF }
function Align([int]$n) { AddBytes([byte[]](0x1B,0x61,[byte]$n)) }
function Bold([bool]$on) { AddBytes([byte[]](0x1B,0x45,[byte]([int]$on))) }
function Size([int]$w, [int]$h) { 
  $nw = [Math]::Max(0,[Math]::Min(7,$w-1))
  $nh = [Math]::Max(0,[Math]::Min(7,$h-1))
  $n = ($nw -shl 4) -bor $nh
  AddBytes([byte[]](0x1D,0x21,[byte]$n))
}
function Cut { AddBytes([byte[]](0x1D,0x56,0x41,0x00)) }
function PadLR([string]$left, [string]$right, [int]$width) {
  if ($null -eq $left) { $left = '' }
  if ($null -eq $right) { $right = '' }
  if ($left.Length -gt $width) { $left = $left.Substring(0,$width) }
  $space = $width - $left.Length - $right.Length
  if ($space -lt 1) { $space = 1 }
  return ($left + (' ' * $space) + $right)
}

AddBytes([byte[]](0x1B,0x40))
$escT = ${escT && escT.match(/^\d+$/) ? escT : '""'}
if ($escT -ne "") { AddBytes([byte[]](0x1B,0x74,[byte]$escT)) }

Align 1
Size 1 1
Bold $true
AddText('MEIDA')
Bold $false
Size 1 1
LF
LF


Align 1
Size 4 4
AddText($order.id)
Size 1 1
LF

if ($order.orderType -and $order.orderType.Trim().Length -gt 0) {
  Align 1
  AddText($order.orderType)
  LF
}

if ($order.phone_number -and $order.phone_number.Trim().Length -gt 0) {
  Align 1
  Size 2 2
  $phoneText = 'Tel: ' + $order.normalizedPhone
  AddText($phoneText)
  Size 1 1
  LF
}

try {
  $dt = [DateTime]::Parse($order.timestamp)
  $dateStr = $dt.ToString('dd.MM.yyyy HH:mm')
} catch {
  $dateStr = $order.timestamp
}

Align 1
AddText($dateStr)
LF

Align 0
Divider

$width = 32
foreach ($it in $order.items) {
  $name = [string]$it.name
  $qty = 'x' + [string]$it.quantity
  Bold $true
  AddText((PadLR $name $qty $width))
  Bold $false
  foreach ($m in $it.modifiers) {
    AddText('  + ' + [string]$m)
    LF
  }
}

Align 0
Divider
Align 1
AddText('${footer.replaceAll("'", "''")}')
LF
LF
LF
LF
LF
Cut

[RawPrinterHelper]::SendBytes($printerName, $b.ToArray())
`

  await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 45000 })
}

async function printTextViaPrintDocument(txtFile: string, printerName: string): Promise<void> {
  const ps = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$printerName = '${printerName.replaceAll("'", "''")}'
$textFile = '${txtFile.replaceAll("'", "''")}'
$text = Get-Content -LiteralPath $textFile -Raw

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $printerName

$paperWidth = 228
$paperHeight = 3000
$paperSize = New-Object System.Drawing.Printing.PaperSize('POS58', $paperWidth, $paperHeight)
$doc.DefaultPageSettings.PaperSize = $paperSize
$doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$doc.OriginAtMargins = $false

$font = New-Object System.Drawing.Font('Courier New', 10)

$doc.add_PrintPage({
  param($sender, $e)
  $rect = New-Object System.Drawing.RectangleF(0, 0, $e.PageBounds.Width, $e.PageBounds.Height)
  $format = New-Object System.Drawing.StringFormat
  $format.Trimming = [System.Drawing.StringTrimming]::Word
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
  $e.Graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, $rect, $format)
  $e.HasMorePages = $false
})

$doc.Print()
`
  await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 45000 })
}

export async function printOrderHtmlViaShellExecute(htmlFile: string): Promise<void> {
  const psCmd = `Start-Process -FilePath '${htmlFile}' -Verb print -PassThru | Wait-Process -Timeout 10`
  try {
    await execFileAsync('powershell', ['-NoProfile', '-Command', psCmd], { timeout: 15000 })
  } catch (e: unknown) {
    const errObj = (e && typeof e === 'object' ? (e as Record<string, unknown>) : undefined)
    const stdout = typeof errObj?.stdout === 'string' ? errObj.stdout : ''
    const stderr = typeof errObj?.stderr === 'string' ? errObj.stderr : ''
    const code = errObj?.code != null ? String(errObj.code) : ''
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `ShellExecute print failed${code ? ` (code ${code})` : ''}: ${msg}${stderr ? `\nSTDERR: ${stderr}` : ''}${stdout ? `\nSTDOUT: ${stdout}` : ''}`
    )
  }
}

export async function printToUSB(order: PrintOrderData): Promise<PrintResult> {
  const config = getPrinterConfig()
  if (!config.name) {
    throw new Error('PRINTER_NAME is not set')
  }

  const tmpBase = path.join(os.tmpdir(), `ticket_${Date.now()}_${Math.floor(Math.random() * 10000)}`)
  const htmlFile = `${tmpBase}.html`
  const txtFile = `${tmpBase}.txt`

  const errors: Record<string, string> = {}

  const useHtml = process.env.PRINTER_USE_HTML === '1'

  if (useHtml) {
    try {
      const html = buildTicketHtml(order)
      fs.writeFileSync(htmlFile, html, 'utf8')
      await printOrderHtmlViaShellExecute(htmlFile)
      return { success: true, method: 'ShellExecute-HTML', errors }
    } catch (e: unknown) {
      errors['ShellExecute-HTML'] = e instanceof Error ? e.message : String(e)
    }
  }

  try {
    const text = buildTextTicket(order)
    fs.writeFileSync(txtFile, text, 'utf8')
    try {
      await printEscPosViaWinspool(order, config.name)
      return { success: true, method: 'ESC-POS-RAW', errors }
    } catch (e2: unknown) {
      errors['ESC-POS-RAW'] = e2 instanceof Error ? e2.message : String(e2)
      try {
        await printTextViaPrintDocument(txtFile, config.name)
        return { success: true, method: 'PrintDocument-TXT', errors }
      } catch (e3: unknown) {
        errors['PrintDocument-TXT'] = e3 instanceof Error ? e3.message : String(e3)
        await printTextViaNotepad(txtFile)
        return { success: true, method: 'Notepad-TXT', errors }
      }
    }
  } finally {
    try { fs.unlinkSync(htmlFile) } catch {}
    try { fs.unlinkSync(txtFile) } catch {}
  }
}
