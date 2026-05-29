$root     = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

# Base64 encode each command to avoid encoding issues with Unicode paths
function Encode-Command($cmd) {
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($cmd)
    return [Convert]::ToBase64String($bytes)
}

$backendCmd  = Encode-Command ".\.venv\Scripts\uvicorn.exe app.main:app --reload"
$frontendCmd = Encode-Command "npm run dev"

Start-Process powershell.exe `
    -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $backendCmd `
    -WorkingDirectory $backend

Start-Sleep -Seconds 2

Start-Process powershell.exe `
    -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $frontendCmd `
    -WorkingDirectory $frontend

Write-Host "Backend : http://localhost:8000/docs"
Write-Host "Frontend: http://localhost:5173"
