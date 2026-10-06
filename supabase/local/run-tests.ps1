<#
.SYNOPSIS
  Apply the Supabase migrations to a throwaway local PostgreSQL database and
  run the database test suite against them.

.DESCRIPTION
  1. Drops and recreates the database (default: carrental_test).
  2. Applies 00_supabase_shim.sql, then 001, 002, 003, 004 from supabase/.
  3. Re-applies 002, 003 and 004 to prove they are safe to re-run.
  4. Runs tests.sql and prints a PASS/FAIL table.

  Exits 0 when every test passes, non-zero otherwise.
  Only ever touches the local test database - never your Supabase project.

.EXAMPLE
  ./supabase/local/run-tests.ps1
  (prompts for the postgres password unless PGPASSWORD is set)
#>
param(
  [string]$PgBin    = 'C:\Program Files\PostgreSQL\18\bin',
  [string]$DbHost   = 'localhost',
  [int]   $Port     = 5432,
  [string]$User     = 'postgres',
  [string]$Database = 'carrental_test'
)

$ErrorActionPreference = 'Stop'
$psql      = Join-Path $PgBin 'psql.exe'
$here      = $PSScriptRoot
$supabase  = Split-Path $here -Parent

if (-not (Test-Path $psql)) {
  throw "psql not found at $psql. Pass -PgBin '<your PostgreSQL bin folder>'."
}

$pgpass = if ($env:PGPASSFILE) { $env:PGPASSFILE } else { Join-Path $env:APPDATA 'postgresql\pgpass.conf' }
if (-not $env:PGPASSWORD -and -not (Test-Path $pgpass)) {
  $secure = Read-Host "Password for PostgreSQL user '$User'" -AsSecureString
  $env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
}
# Silence "does not exist, skipping" notices from the idempotent DROPs.
$env:PGOPTIONS = '-c client_min_messages=warning'

function Invoke-Psql([string]$Db, [string[]]$Arguments) {
  & $psql -h $DbHost -p $Port -U $User -d $Db -X -q -v ON_ERROR_STOP=1 @Arguments
  if ($LASTEXITCODE -ne 0) { throw "psql failed ($LASTEXITCODE): $Arguments" }
}

Write-Host "Recreating database '$Database'..."
Invoke-Psql 'postgres' @('-c', "drop database if exists $Database with (force)")
Invoke-Psql 'postgres' @('-c', "create database $Database")

$steps = @(
  (Join-Path $here     '00_supabase_shim.sql'),
  (Join-Path $supabase '001_schema_and_seed.sql'),
  (Join-Path $supabase '002_functions.sql'),
  (Join-Path $supabase '003_rls.sql'),
  (Join-Path $supabase '004_audit_log.sql'),
  # Second pass: 002, 003 and 004 promise they are safe to re-run.
  (Join-Path $supabase '002_functions.sql'),
  (Join-Path $supabase '003_rls.sql'),
  (Join-Path $supabase '004_audit_log.sql')
)

foreach ($file in $steps) {
  Write-Host "Applying $(Split-Path $file -Leaf)"
  Invoke-Psql $Database @('-f', $file) | Out-Null
}

Write-Host "`nRunning tests`n"
& $psql -h $DbHost -p $Port -U $User -d $Database -X -f (Join-Path $here 'tests.sql')
exit $LASTEXITCODE
