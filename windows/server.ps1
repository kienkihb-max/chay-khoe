# May chu web nho chay tren may nay (khong can cai gi them, dung PowerShell co san cua Windows)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))
$port = 8765
$mime = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.json'='application/json';
  '.css'='text/css'; '.wasm'='application/wasm'; '.png'='image/png'; '.jpg'='image/jpeg'; '.ico'='image/x-icon';
  '.tflite'='application/octet-stream'; '.data'='application/octet-stream'; '.binarypb'='application/octet-stream'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch {
  Write-Host "Khong mo duoc cong $port. Co the chuong trinh nay dang chay san o cua so khac." -ForegroundColor Red
  Write-Host $_.Exception.Message
  exit 1
}
Write-Host ""
Write-Host "  Da chay xong. Trinh duyet se tu mo: http://localhost:$port/" -ForegroundColor Green
Write-Host "  Dung xong thi dong cua so den nay." -ForegroundColor Yellow
Start-Process "http://localhost:$port/index.html"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $res = $ctx.Response
  try {
    $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($p -eq '/') { $p = '/index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root ($p.TrimStart('/').Replace('/', '\'))))
    if ($full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $ext = [IO.Path]::GetExtension($full).ToLower()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($full)
      $res.ContentType = $type
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.OutputStream.Close() } catch {}
    try { $res.Close() } catch {}
  }
}
