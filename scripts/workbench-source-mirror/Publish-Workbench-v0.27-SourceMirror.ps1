$ErrorActionPreference = 'Stop'

# Matawaka Workbench v0.27 source mirror
# External human maintenance action. This script does NOT grant network authority
# to Matawaka Workbench itself and does NOT modify Matawaka/uu-aap main.

$Repo = 'K:\Matawaka\Workbench'
$ExpectedHead = '8cdea04c2304f8589e9120d0451efa9e7e6b2f2b'
$ExpectedTag = 'workbench-v0.27-accepted'

$RemoteName = 'github-backup'
$RemoteUrl = 'https://github.com/Matawaka/uu-aap.git'
$RemoteBranch = 'workbench-source/v0.27-accepted'
$RemoteTag = 'workbench-v0.27-accepted'

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$GitArgs)
    $output = & git -C $Repo @GitArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed:`n$($output -join "`n")"
    }
    return @($output)
}

if (-not (Test-Path -LiteralPath $Repo -PathType Container)) {
    throw "Workbench repository not found: $Repo"
}
if (-not (Test-Path -LiteralPath (Join-Path $Repo '.git'))) {
    throw "Not a Git worktree root: $Repo"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'git.exe is not available in PATH.'
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'gh.exe is not available in PATH.'
}

Write-Host '== 1. Verify exact accepted Workbench frontier =='
$Head = (Invoke-Git rev-parse HEAD)[0].Trim()
if ($Head -ne $ExpectedHead) {
    throw "HEAD drift: expected $ExpectedHead, observed $Head"
}

$Dirty = @(Invoke-Git status --porcelain)
if ($Dirty.Count -ne 0 -and ($Dirty -join '').Trim().Length -ne 0) {
    throw "Working tree is not clean:`n$($Dirty -join "`n")"
}

$TagCommit = (Invoke-Git rev-list -n 1 $ExpectedTag)[0].Trim()
if ($TagCommit -ne $ExpectedHead) {
    throw "Accepted tag drift: $ExpectedTag resolves to $TagCommit, expected $ExpectedHead"
}

Write-Host "Verified HEAD: $Head"
Write-Host "Verified tag:  $ExpectedTag -> $TagCommit"

Write-Host ''
Write-Host '== 2. Verify GitHub authentication =='
& gh auth status
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI is not authenticated.'
}
& gh auth setup-git
if ($LASTEXITCODE -ne 0) {
    throw 'gh auth setup-git failed.'
}

Write-Host ''
Write-Host '== 3. Configure bounded backup remote =='
$ExistingRemotes = @(Invoke-Git remote)
if ($ExistingRemotes -contains $RemoteName) {
    $ExistingUrl = (Invoke-Git remote get-url $RemoteName)[0].Trim()
    if ($ExistingUrl -ne $RemoteUrl) {
        throw "Remote '$RemoteName' already exists with a different URL: $ExistingUrl"
    }
    Write-Host "Remote already correct: $RemoteName -> $RemoteUrl"
}
else {
    Invoke-Git remote add $RemoteName $RemoteUrl | Out-Null
    Write-Host "Added remote: $RemoteName -> $RemoteUrl"
}

Write-Host ''
Write-Host '== 4. Refuse conflicting remote refs before publication =='
$ExistingBranchLine = @(& git -C $Repo ls-remote --heads $RemoteName "refs/heads/$RemoteBranch" 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw "git ls-remote branch check failed:`n$($ExistingBranchLine -join "`n")"
}
if ($ExistingBranchLine.Count -gt 0 -and ($ExistingBranchLine -join '').Trim()) {
    $ExistingBranchSha = (($ExistingBranchLine[0] -split '\s+')[0]).Trim()
    if ($ExistingBranchSha -ne $ExpectedHead) {
        throw "Remote branch conflict: $RemoteBranch is $ExistingBranchSha, expected $ExpectedHead"
    }
}

$ExistingTagLines = @(& git -C $Repo ls-remote $RemoteName "refs/tags/$RemoteTag" "refs/tags/$RemoteTag^{}" 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw "git ls-remote tag check failed:`n$($ExistingTagLines -join "`n")"
}
if ($ExistingTagLines.Count -gt 0 -and ($ExistingTagLines -join '').Trim()) {
    $Peeled = $ExistingTagLines |
        Where-Object { $_ -match '\^\{\}$' } |
        Select-Object -First 1
    if ($Peeled) {
        $ExistingTagCommit = (($Peeled -split '\s+')[0]).Trim()
    }
    else {
        $ExistingTagCommit = (($ExistingTagLines[0] -split '\s+')[0]).Trim()
    }
    if ($ExistingTagCommit -ne $ExpectedHead) {
        throw "Remote tag conflict: $RemoteTag resolves to $ExistingTagCommit, expected $ExpectedHead"
    }
}

Write-Host ''
Write-Host '== 5. Publish exact accepted source as unrelated-history namespaced refs =='
& git -C $Repo push $RemoteName "HEAD:refs/heads/$RemoteBranch"
if ($LASTEXITCODE -ne 0) {
    throw 'Source branch push failed.'
}
& git -C $Repo push $RemoteName "refs/tags/$ExpectedTag:refs/tags/$RemoteTag"
if ($LASTEXITCODE -ne 0) {
    throw 'Accepted tag push failed.'
}

Write-Host ''
Write-Host '== 6. Verify remote byte-history identity =='
$RemoteBranchLine = @(& git -C $Repo ls-remote --heads $RemoteName "refs/heads/$RemoteBranch" 2>&1)
if ($LASTEXITCODE -ne 0 -or $RemoteBranchLine.Count -eq 0) {
    throw 'Published source branch cannot be resolved remotely.'
}
$RemoteBranchCommit = (($RemoteBranchLine[0] -split '\s+')[0]).Trim()
if ($RemoteBranchCommit -ne $ExpectedHead) {
    throw "Remote branch verification failed: $RemoteBranchCommit != $ExpectedHead"
}

$RemoteTagLines = @(& git -C $Repo ls-remote $RemoteName "refs/tags/$RemoteTag" "refs/tags/$RemoteTag^{}" 2>&1)
if ($LASTEXITCODE -ne 0 -or $RemoteTagLines.Count -eq 0) {
    throw 'Published source tag cannot be resolved remotely.'
}
$PeeledRemoteTag = $RemoteTagLines |
    Where-Object { $_ -match '\^\{\}$' } |
    Select-Object -First 1
if ($PeeledRemoteTag) {
    $RemoteTagCommit = (($PeeledRemoteTag -split '\s+')[0]).Trim()
}
else {
    $RemoteTagCommit = (($RemoteTagLines[0] -split '\s+')[0]).Trim()
}
if ($RemoteTagCommit -ne $ExpectedHead) {
    throw "Remote tag verification failed: $RemoteTagCommit != $ExpectedHead"
}

$DirtyAfter = @(Invoke-Git status --porcelain)
if ($DirtyAfter.Count -ne 0 -and ($DirtyAfter -join '').Trim().Length -ne 0) {
    throw "Working tree became dirty after publication:`n$($DirtyAfter -join "`n")"
}
$HeadAfter = (Invoke-Git rev-parse HEAD)[0].Trim()
if ($HeadAfter -ne $ExpectedHead) {
    throw "Local HEAD changed during publication: $HeadAfter"
}

Write-Host ''
Write-Host '== 7. Write external publication receipt =='
$ReceiptRoot = 'K:\Matawaka\Workbench-Publication'
New-Item -ItemType Directory -Force -Path $ReceiptRoot | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
$ReceiptPath = Join-Path $ReceiptRoot "workbench-source-mirror-v0.27-$Stamp.json"

$Receipt = [ordered]@{
    Schema = 'matawaka.workbench-source-publication-receipt/v0.27'
    Version = '0.27.0'
    ObservedAt = (Get-Date).ToString('o')
    Passed = $true
    Status = 'SOURCE_MIRROR_PUBLISHED'
    LocalRepositoryRoot = $Repo
    LocalHead = $ExpectedHead
    LocalAcceptedTag = $ExpectedTag
    LocalWorkingTreeCleanAfter = $true
    RemoteRepository = 'Matawaka/uu-aap'
    RemoteUrl = $RemoteUrl
    RemoteBranch = $RemoteBranch
    RemoteBranchCommit = $RemoteBranchCommit
    RemoteTag = $RemoteTag
    RemoteTagPeeledCommit = $RemoteTagCommit
    UuAapMainMutationAllowed = $false
    UuAapMainMutationPerformedByThisScript = $false
    WorkbenchRuntimeNetworkAuthorityGranted = $false
    PublicationAuthority = [ordered]@{
        Subject = 'human-operator-external-git-maintenance'
        Operation = 'git.publish.namespaced-workbench-source-mirror'
        LocalSourceMutationAllowed = $false
        LocalCommitOrTagCreationAllowed = $false
        RemoteNamespacedRefCreationAllowed = $true
        RemoteMainMutationAllowed = $false
        ForcePushAllowed = $false
    }
    NonEffects = @(
        'no Workbench source file mutation',
        'no local commit creation',
        'no local tag creation or movement',
        'no remote uu-aap/main mutation',
        'no Workbench runtime or Agent Execute network authority',
        'no canonical UU-AAP conformance claim',
        'no Stable Core promotion'
    )
    Note = 'External human Git maintenance publication of the exact accepted Workbench v0.27 commit into namespaced unrelated-history refs. Source availability is preserved without importing the Workbench tree into uu-aap/main.'
}

$Receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8

Write-Host ''
Write-Host 'SOURCE MIRROR PUBLISHED'
Write-Host "Branch: $RemoteBranch -> $RemoteBranchCommit"
Write-Host "Tag:    $RemoteTag -> $RemoteTagCommit"
Write-Host "Receipt: $ReceiptPath"
