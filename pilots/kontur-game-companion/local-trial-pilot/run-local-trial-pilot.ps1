param(
    [ValidateSet('safe-default', 'synthetic-ready')]
    [string]$Scenario = 'synthetic-ready',
    [string]$PythonPath = $env:KONTUR_PYTHON
)

$ErrorActionPreference = 'Stop'
$pilotScript = Join-Path $PSScriptRoot 'run.py'
$pythonPrefix = @()

if ($PythonPath) {
    if (-not (Test-Path -LiteralPath $PythonPath -PathType Leaf)) {
        throw "Python executable not found: $PythonPath"
    }
    $pythonExecutable = (Resolve-Path -LiteralPath $PythonPath).Path
} else {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        $pythonExecutable = $pythonCommand.Source
    } else {
        $pyCommand = Get-Command py -ErrorAction SilentlyContinue
        if (-not $pyCommand) {
            throw 'Python not found. Pass -PythonPath or set KONTUR_PYTHON.'
        }
        $pythonExecutable = $pyCommand.Source
        $pythonPrefix = @('-3')
    }
}

& $pythonExecutable @pythonPrefix $pilotScript '--scenario' $Scenario '--pretty'
exit $LASTEXITCODE
