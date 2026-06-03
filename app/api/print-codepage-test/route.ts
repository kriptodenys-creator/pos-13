import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function POST() {
  console.log('[API /print-codepage-test] Running codepage test v2')
  const printerName = process.env.PRINTER_NAME
  if (!printerName) {
    return Response.json({ success: false, error: 'PRINTER_NAME is not set' }, { status: 500 })
  }

  const ps = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$printerName = '${printerName.replaceAll("'", "''")}'

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
      di.pDocName = "Codepage Test";
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

function BuildLine([string]$label, [int]$t, [string]$encName) {
  $enc = [System.Text.Encoding]::GetEncoding($encName)
  $ascii = [System.Text.Encoding]::ASCII
  $b = New-Object System.Collections.Generic.List[byte]
  $b.AddRange([byte[]](0x1B,0x40)) | Out-Null
  $b.AddRange([byte[]](0x1B,0x74,[byte]$t)) | Out-Null
  $b.AddRange($ascii.GetBytes(('ASCII_OK ' + $label + ' t=' + [string]$t + ' enc=' + $encName + ' | '))) | Out-Null
  $text = "$label  ESC t=$t  enc=$encName  ->  Išsinešti  Aštrus  Be svogūnų  Žąsis  ąčęėįšųūž" 
  $b.AddRange($enc.GetBytes($text)) | Out-Null
  $b.AddRange([byte[]](0x0D,0x0A)) | Out-Null
  return $b
}

$all = New-Object System.Collections.Generic.List[byte]
$all.AddRange([byte[]](0x1B,0x40)) | Out-Null

$ascii = [System.Text.Encoding]::ASCII
$all.AddRange($ascii.GetBytes('ASCII_OK GLOBAL 123 ABC abc')) | Out-Null
$all.AddRange([byte[]](0x0D,0x0A,0x0D,0x0A)) | Out-Null

# Minimal print without ESC t (debug):
$all.AddRange($ascii.GetBytes('MINIMAL_ONLY_NO_ESC_T')) | Out-Null
$all.AddRange([byte[]](0x0D,0x0A,0x0D,0x0A)) | Out-Null

$tests = @(16,17,18,19,22,23,24,25,30,31,32,33,34,35,36)
$encs = @('windows-1257','ibm852')
foreach ($encName in $encs) {
  foreach ($t in $tests) {
    $bytes = (BuildLine ('TEST' + $encName) $t $encName).ToArray()
    $all.AddRange($bytes) | Out-Null
  }
  $all.AddRange([byte[]](0x0A)) | Out-Null
}
$all.AddRange([byte[]](0x0A,0x0A,0x0A)) | Out-Null
$all.AddRange([byte[]](0x1D,0x56,0x41,0x00)) | Out-Null

[RawPrinterHelper]::SendBytes($printerName, $all.ToArray())
`

  try {
    await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { timeout: 45000 })
    return Response.json({ success: true })
  } catch (e: any) {
    return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 })
  }
}

export async function GET() {
  return POST()
}
