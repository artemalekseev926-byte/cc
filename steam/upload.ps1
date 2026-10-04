param(
  [Parameter(Mandatory = $true)][string]$AppId,
  [Parameter(Mandatory = $true)][string]$DepotId,
  [Parameter(Mandatory = $true)][string]$SteamUser,
  [string]$ContentRoot = "",
  [string]$Description = "",
  [string]$SetLiveBranch = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $ContentRoot) { $ContentRoot = Join-Path $root "release\win-unpacked" }
$ContentRoot = (Resolve-Path $ContentRoot).Path
if (-not (Test-Path (Join-Path $ContentRoot "DeskForge.exe"))) {
  throw "DeskForge.exe not found in $ContentRoot. Run 'npm run dist:win' or unpack the release zip there."
}

$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
if (-not $Description) { $Description = "DeskForge $version" }

$steamcmdDir = Join-Path $PSScriptRoot "steamcmd"
$steamcmd = Join-Path $steamcmdDir "steamcmd.exe"
if (-not (Test-Path $steamcmd)) {
  Write-Host "Downloading SteamCMD..."
  New-Item -ItemType Directory -Force -Path $steamcmdDir | Out-Null
  $zip = Join-Path $steamcmdDir "steamcmd.zip"
  Invoke-WebRequest "https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip" -OutFile $zip
  Expand-Archive $zip -DestinationPath $steamcmdDir -Force
  Remove-Item $zip
}

$outDir = Join-Path $PSScriptRoot "output"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$depotVdf = Join-Path $outDir "depot_build_$DepotId.vdf"
@"
"DepotBuild"
{
	"DepotID" "$DepotId"
	"ContentRoot" "$ContentRoot"
	"FileMapping"
	{
		"LocalPath" "*"
		"DepotPath" "."
		"Recursive" "1"
	}
	"FileExclusion" "steam_appid.txt"
	"FileExclusion" "*.pdb"
}
"@ | Set-Content -Encoding UTF8 $depotVdf

$setLive = if ($SetLiveBranch) { "`t`"SetLive`" `"$SetLiveBranch`"" } else { "" }
$appVdf = Join-Path $outDir "app_build_$AppId.vdf"
@"
"AppBuild"
{
	"AppID" "$AppId"
	"Desc" "$Description"
	"ContentRoot" "$ContentRoot"
	"BuildOutput" "$outDir"
$setLive
	"Depots"
	{
		"$DepotId" "$depotVdf"
	}
}
"@ | Set-Content -Encoding UTF8 $appVdf

Write-Host "Uploading $ContentRoot as '$Description' to app $AppId / depot $DepotId..."
& $steamcmd +login $SteamUser +run_app_build $appVdf +quit
if ($LASTEXITCODE -ne 0) { throw "SteamCMD failed with exit code $LASTEXITCODE" }
Write-Host "Done. Open Steamworks -> SteamPipe -> Builds to set the build live."
