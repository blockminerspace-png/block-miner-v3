#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy via git pull no VPS + docker compose up -d --build --no-deps app.

.DESCRIPTION
  Credenciais em deploy.secrets.local (SSH_HOST, SSH_USER, SSH_PASSWORD, REMOTE_PATH).
  Opcional: SSH_HOSTKEY=SHA256:... quando o PuTTY recusa o IP (host key mudou / IP reutilizado).
  Requer PuTTY (plink.exe) em "C:\Program Files\PuTTY\".

.EXAMPLE
  .\scripts\deploy-vps-windows.ps1
#>
param(
    [string] $SshHost    = '89.167.119.164',
    [string] $SshUser    = 'root',
    [string] $RemotePath = '/root/block-miner',
    [string] $PlinkExe   = 'C:\Program Files\PuTTY\plink.exe',
    [string] $ComposeService = 'app',
    [switch] $RemoveOrphans,
    [string] $LetsEncryptDomain = '',
    [switch] $NoDockerCache
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

# --- Le credenciais de deploy.secrets.local ---
$deploySecretsPath = Join-Path $RepoRoot 'deploy.secrets.local'
$deploySecrets = @{}
if (Test-Path -LiteralPath $deploySecretsPath) {
    Get-Content -LiteralPath $deploySecretsPath -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $ix = $line.IndexOf('=')
        if ($ix -lt 1) { return }
        $k = $line.Substring(0, $ix).Trim()
        $v = $line.Substring($ix + 1).Trim()
        if ($k) { $deploySecrets[$k] = $v }
    }
}
# Parâmetros passados na linha de comando ganham sobre deploy.secrets.local
if (-not $PSBoundParameters.ContainsKey('SshHost') -and $deploySecrets['SSH_HOST']) {
    $SshHost = $deploySecrets['SSH_HOST']
}
if (-not $PSBoundParameters.ContainsKey('SshUser') -and $deploySecrets['SSH_USER']) {
    $SshUser = $deploySecrets['SSH_USER']
}
if (-not $PSBoundParameters.ContainsKey('RemotePath') -and $deploySecrets['REMOTE_PATH']) {
    $RemotePath = $deploySecrets['REMOTE_PATH']
}
if (-not $PSBoundParameters.ContainsKey('LetsEncryptDomain') -and $deploySecrets['LE_SYNC_DOMAIN']) {
    $LetsEncryptDomain = $deploySecrets['LE_SYNC_DOMAIN']
}

# Env (ex.: python deploy.py) ganha sobre ficheiro — deploy.py e a fonte quando usas npm run deploy
$SshPassword = $env:BLOCKMINER_VPS_PW
if (-not $SshPassword) { $SshPassword = $deploySecrets['SSH_PASSWORD'] }
if (-not $SshPassword) { throw "Defina credenciais em deploy.py (docstring) ou SSH_PASSWORD em deploy.secrets.local ou `$env:BLOCKMINER_VPS_PW" }

if (-not (Test-Path -LiteralPath $PlinkExe)) { throw "plink nao encontrado: $PlinkExe (instale PuTTY)." }

# Build map of VITE_* overrides: deploy.secrets.local wins over process env; then merged into .env text before upload.
function Get-ViteEnvOverrideMap {
    param([hashtable]$Secrets)
    $map = @{}
    $names = @(
        'VITE_WALLETCONNECT_PROJECT_ID',
        'VITE_PUBLIC_WALLET_APP_URL',
        'VITE_POLYGON_RPC_URL',
        'VITE_DISCORD_URL',
        'VITE_TELEGRAM_URL',
        'VITE_TWITTER_URL',
        'VITE_YOUTUBE_URL',
        'VITE_GA_ID'
    )
    foreach ($k in $names) {
        $fromFile = $Secrets[$k]
        if ($fromFile -and $fromFile.Trim()) {
            $map[$k] = $fromFile.Trim()
            continue
        }
        $fromProc = [Environment]::GetEnvironmentVariable($k, 'Process')
        if ($fromProc -and $fromProc.Trim()) { $map[$k] = $fromProc.Trim() }
    }
    foreach ($key in $Secrets.Keys) {
        if ($key -match '^VITE_' -and $Secrets[$key] -and $Secrets[$key].Trim()) {
            $map[$key] = $Secrets[$key].Trim()
        }
    }
    return $map
}

function Apply-ViteOverridesToEnvText {
    param(
        [string]$Content,
        [hashtable]$ViteMap
    )
    $out = if ($null -eq $Content) { '' } else { $Content }
    foreach ($k in $ViteMap.Keys) {
        $v = $ViteMap[$k]
        if (-not $v) { continue }
        $esc = [regex]::Escape($k)
        $pattern = "(?m)^[ \t]*${esc}[ \t]*=[ \t]*.*\r?$"
        $line = "${k}=$v"
        if ($out -match $pattern) {
            $out = $out -replace $pattern, $line
        } else {
            if ($out.Length -gt 0 -and -not $out.EndsWith("`n")) { $out += "`n" }
            $out += "$line`n"
        }
    }
    return $out
}

function Test-MergedEnvHasWalletConnectId {
    param([string]$Text)
    if (-not $Text) { return $false }
    foreach ($raw in $Text -split "`r?`n") {
        $line = $raw.Trim()
        if ($line -match '^\s*#' -or -not $line) { continue }
        if ($line -match '^\s*VITE_WALLETCONNECT_PROJECT_ID\s*=\s*(.*)$') {
            $val = $matches[1].Trim().Trim('"').Trim("'")
            if ($val.Length -lt 8) { return $false }
            if ($val -match '^(your_|changeme|placeholder|example)') { return $false }
            return $true
        }
    }
    return $false
}

$plinkHostKeyArgs = @()
$sshHostKey = $deploySecrets['SSH_HOSTKEY']
if ($sshHostKey) {
    $sshHostKey = $sshHostKey.Trim()
    if ($sshHostKey) { $plinkHostKeyArgs = @('-hostkey', $sshHostKey) }
}

# Grava senha em temp file (sem CRLF)
$tmpPw = Join-Path ([System.IO.Path]::GetTempPath()) ("bm_pw_{0}.txt" -f [Guid]::NewGuid().ToString('N'))
[System.IO.File]::WriteAllText($tmpPw, $SshPassword.Trim(), [System.Text.UTF8Encoding]::new($false))
$tmpMergedEnv = $null

try {
    # --- Upload do .env.production real para o VPS (deve ser APÓS git reset para não ser apagado) ---
    $envBackupPath = Join-Path $RepoRoot '.env.production.vm-backup'
    if (-not (Test-Path -LiteralPath $envBackupPath)) {
        Write-Warning ".env.production.vm-backup nao encontrado - deploy pode falhar sem env"
    }

    # Primeiro faz git reset no VPS
    $remoteGitCmd = "set -e`ncd $RemotePath`ngit fetch origin`ngit reset --hard origin/main`n"
    Write-Host "==> git reset no VPS ($SshHost)..."
    & $PlinkExe -batch -ssh @plinkHostKeyArgs -pwfile $tmpPw "${SshUser}@${SshHost}" $remoteGitCmd

    $skipEnvUpload = $deploySecrets['DEPLOY_SKIP_ENV_UPLOAD'] -eq '1' -or $deploySecrets['DEPLOY_SKIP_ENV_UPLOAD'] -eq 'true'
    if (-not $skipEnvUpload) {
        $viteMap = Get-ViteEnvOverrideMap -Secrets $deploySecrets
        $baseEnvText = ''
        if (Test-Path -LiteralPath $envBackupPath) {
            $baseEnvText = [System.IO.File]::ReadAllText($envBackupPath, [System.Text.UTF8Encoding]::new($false))
        } else {
            Write-Warning ".env.production.vm-backup ausente — a gerar .env só com overrides VITE_* (coloca backup completo na raiz do repo)."
            $baseEnvText = "# Generated by deploy — merge with full production secrets`nNODE_ENV=production`nPORT=3000`n"
        }
        $mergedEnvText = Apply-ViteOverridesToEnvText -Content $baseEnvText -ViteMap $viteMap
        $requireWc = $deploySecrets['DEPLOY_REQUIRE_WALLETCONNECT'] -eq '1' -or $deploySecrets['DEPLOY_REQUIRE_WALLETCONNECT'] -eq 'true'
        $hasWc = Test-MergedEnvHasWalletConnectId -Text $mergedEnvText
        if (-not $hasWc) {
            $msg = 'VITE_WALLETCONNECT_PROJECT_ID em falta ou invalido no env enviado. Adiciona em deploy.secrets.local ou .env.production.vm-backup (WalletConnect Cloud / Reown).'
            if ($requireWc) { throw $msg }
            Write-Warning $msg
        } else {
            Write-Host "==> VITE_WALLETCONNECT_PROJECT_ID presente no .env merged (WalletConnect OK no build/runtime)."
        }
        $tmpMergedEnv = Join-Path ([System.IO.Path]::GetTempPath()) ("bm_merged_env_{0}.env" -f [Guid]::NewGuid().ToString('N'))
        [System.IO.File]::WriteAllText($tmpMergedEnv, $mergedEnvText, [System.Text.UTF8Encoding]::new($false))
        Write-Host "==> Uploading merged .env.production to VPS (VITE_* from deploy.secrets.local + vm-backup)..."
        $pscpExe = Join-Path (Split-Path $PlinkExe) 'pscp.exe'
        # Use -pwfile like plink: -pw can fail with special characters or quoting differences.
        & $pscpExe -batch @plinkHostKeyArgs -pwfile $tmpPw $tmpMergedEnv "${SshUser}@${SshHost}:${RemotePath}/.env.production"
        if ($LASTEXITCODE -ne 0) { throw "pscp falhou ao enviar .env.production" }
    } else {
        Write-Host "==> Skip .env.production upload (DEPLOY_SKIP_ENV_UPLOAD)."
    }

    # Após git reset, certificados PEM commitados no repo (dev) sobrescrevem os da VM —
    # se houver Let's Encrypt no servidor, volta a copiar para nginx/certs antes do nginx subir.
    if ($LetsEncryptDomain) {
        $le = $LetsEncryptDomain.Trim()
        Write-Host "==> Sync Let's Encrypt -> nginx/certs ($le)..."
        $syncCmd = @"
set -e
cd $RemotePath
mkdir -p nginx/certs
if [ -f "/etc/letsencrypt/live/$le/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$le/privkey.pem" ]; then
  cp "/etc/letsencrypt/live/$le/fullchain.pem" nginx/certs/cert.pem
  cp "/etc/letsencrypt/live/$le/privkey.pem" nginx/certs/key.pem
  chmod 644 nginx/certs/cert.pem
  chmod 600 nginx/certs/key.pem
  echo "LE sync OK for $le"
else
  echo "WARNING: LE_SYNC_DOMAIN=$le but /etc/letsencrypt/live/$le missing — HTTPS pode falhar"
fi
"@
        & $PlinkExe -batch -ssh @plinkHostKeyArgs -pwfile $tmpPw "${SshUser}@${SshHost}" $syncCmd
    }

    # Por último faz o build e restart (serviço típico: app → 127.0.0.1:3000)
    $orph = if ($RemoveOrphans) { ' --remove-orphans' } else { '' }
    # --env-file .env.production: injects VITE_* into compose build args so WalletConnect project id ships in the SPA bundle.
    $composeEnv = "docker compose --env-file .env.production"
    $buildStep = if ($NoDockerCache) {
        "$composeEnv build --no-cache $ComposeService && $composeEnv up -d --no-deps$orph $ComposeService"
    } else {
        "$composeEnv up -d --build --no-deps$orph $ComposeService"
    }
    # Sobe DB + reverse proxy: antes só o app era reiniciado (--no-deps) e o nginx ficava parado.
    $remoteBuildCmd = @"
set -e
cd $RemotePath
$composeEnv up -d db
$buildStep
$composeEnv up -d nginx
$composeEnv ps
$composeEnv exec -T nginx nginx -s reload 2>/dev/null || true
sleep 2
curl -sS -o /dev/null -w 'health_http:%{http_code}\n' http://127.0.0.1:3000/health || true
"@
    Write-Host "==> docker compose build no VPS ($SshHost)..."
    & $PlinkExe -batch -ssh @plinkHostKeyArgs -pwfile $tmpPw "${SshUser}@${SshHost}" $remoteBuildCmd

    $runMigrate = $deploySecrets['DEPLOY_PRISMA_MIGRATE_DEPLOY']
    if ($runMigrate -eq '1' -or ($runMigrate -and $runMigrate.ToLower() -eq 'true')) {
        $resolveRbRaw = $deploySecrets['DEPLOY_PRISMA_MIGRATE_RESOLVE_ROLLED_BACK']
        $resolveRb = if ($resolveRbRaw) { $resolveRbRaw.Trim() } else { '' }
        if ($resolveRb) {
            Write-Host "==> prisma migrate resolve --rolled-back $resolveRb ..."
            $resolveRemote = @"
set -e
cd $RemotePath
docker compose exec -T $ComposeService npx prisma migrate resolve --rolled-back $resolveRb --schema=server/prisma/schema.prisma
"@
            & $PlinkExe -batch -ssh @plinkHostKeyArgs -pwfile $tmpPw "${SshUser}@${SshHost}" $resolveRemote
        }
        Write-Host "==> prisma migrate deploy no contentor ($ComposeService)..."
        $migrateRemote = @"
set -e
cd $RemotePath
docker compose exec -T $ComposeService npx prisma migrate deploy --schema=server/prisma/schema.prisma
"@
        & $PlinkExe -batch -ssh @plinkHostKeyArgs -pwfile $tmpPw "${SshUser}@${SshHost}" $migrateRemote
    }

    Write-Host '==> Feito.'
}
finally {
    Remove-Item -LiteralPath $tmpPw -Force -ErrorAction SilentlyContinue
    if ($tmpMergedEnv -and (Test-Path -LiteralPath $tmpMergedEnv)) {
        Remove-Item -LiteralPath $tmpMergedEnv -Force -ErrorAction SilentlyContinue
    }
}