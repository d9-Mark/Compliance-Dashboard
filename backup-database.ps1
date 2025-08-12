# backup-database.ps1 - FIXED VERSION
# Get DATABASE_URL from .env file
$envFile = Get-Content .env -ErrorAction SilentlyContinue
$databaseUrl = ""

foreach ($line in $envFile) {
    if ($line -match "^DATABASE_URL=(.*)") {
        $databaseUrl = $matches[1].Trim('"')
        break
    }
}

if (-not $databaseUrl) {
    Write-Host "❌ DATABASE_URL not found in .env file" -ForegroundColor Red
    Write-Host "🔍 Looking for .env file in current directory..." -ForegroundColor Yellow
    Get-ChildItem -Name "*.env*"
    exit 1
}

Write-Host "🔍 Found DATABASE_URL: $($databaseUrl.Substring(0, 20))..." -ForegroundColor Cyan

# Parse DATABASE_URL - FIXED: Using different variable names
if ($databaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)") {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]  # Changed from $host to $dbHost
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "✅ Parsed connection details:" -ForegroundColor Green
    Write-Host "   Host: $dbHost" -ForegroundColor Gray
    Write-Host "   Port: $dbPort" -ForegroundColor Gray
    Write-Host "   Database: $dbName" -ForegroundColor Gray
    Write-Host "   User: $dbUser" -ForegroundColor Gray
} else {
    Write-Host "❌ Could not parse DATABASE_URL format" -ForegroundColor Red
    Write-Host "Expected format: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    Write-Host "Got: $databaseUrl" -ForegroundColor Gray
    exit 1
}

# Create backup directory
$backupDir = "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir
    Write-Host "📁 Created backup directory: $backupDir" -ForegroundColor Green
}

# Generate timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\compliance_dash_backup_$timestamp.sql"

Write-Host "🛡️  Creating database backup..." -ForegroundColor Blue
Write-Host "📊 Database: $dbName on $dbHost`:$dbPort" -ForegroundColor Cyan

# Test if pg_dump is available
try {
    $pgDumpVersion = & pg_dump --version 2>$null
    Write-Host "✅ Found pg_dump: $pgDumpVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pg_dump not found in PATH" -ForegroundColor Red
    Write-Host "💡 Install PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "   1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "   2. Or use chocolatey: choco install postgresql" -ForegroundColor Gray
    Write-Host "   3. Or use scoop: scoop install postgresql" -ForegroundColor Gray
    exit 1
}

# Set password environment variable for pg_dump
$env:PGPASSWORD = $dbPassword

Write-Host "🔄 Running pg_dump..." -ForegroundColor Blue

# Run pg_dump with better error handling
try {
    & pg_dump --host=$dbHost --port=$dbPort --username=$dbUser --dbname=$dbName --no-password --verbose --clean --if-exists --create --format=plain --file=$backupFile 2>&1 | Out-Host
    
    if ($LASTEXITCODE -eq 0) {
        if (Test-Path $backupFile) {
            $fileSize = (Get-Item $backupFile).Length
            $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
            
            Write-Host "✅ Backup created successfully!" -ForegroundColor Green
            Write-Host "📁 File: $backupFile" -ForegroundColor Cyan
            Write-Host "📊 Size: $fileSizeMB MB" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "🔧 To restore if needed:" -ForegroundColor Yellow
            Write-Host "   psql -h $dbHost -p $dbPort -U $dbUser -d postgres -f `"$backupFile`"" -ForegroundColor Gray
            Write-Host ""
            Write-Host "🚀 Your database is now safely backed up!" -ForegroundColor Green
            Write-Host "   You can now proceed with the CVE integration." -ForegroundColor Green
        } else {
            Write-Host "❌ Backup file was not created" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ pg_dump failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running pg_dump: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Clear password from environment
$env:PGPASSWORD = $null

Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Blue
Write-Host "   1. Run the schema update: psql `"$databaseUrl`" -f quick-cve-schema-update.sql" -ForegroundColor Gray
Write-Host "   2. Add the CVE service files to your project" -ForegroundColor Gray
Write-Host "   3. Update your tRPC router" -ForegroundColor Gray
Write-Host "   4. Test the CVE sync in your admin dashboard" -ForegroundColor Gray