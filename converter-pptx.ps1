# Converte um .pptx em PDF usando o PowerPoint instalado (automação COM).
# Uso: .\converter-pptx.ps1 -Entrada slides.pptx [-Saida slides.pdf]
param(
    [Parameter(Mandatory = $true)][string]$Entrada,
    [string]$Saida
)

$ErrorActionPreference = 'Stop'
$ppSaveAsPDF = 32

$Entrada = (Resolve-Path -LiteralPath $Entrada).Path
if (-not $Saida) { $Saida = [IO.Path]::ChangeExtension($Entrada, '.pdf') }
$Saida = [IO.Path]::GetFullPath($Saida)

$ppt = New-Object -ComObject PowerPoint.Application
try {
    # Open(FileName, ReadOnly, Untitled, WithWindow)
    $pres = $ppt.Presentations.Open($Entrada, -1, 0, 0)
    try {
        $pres.SaveAs($Saida, $ppSaveAsPDF)
    } finally {
        $pres.Close()
    }
} finally {
    # Só fecha o PowerPoint se não houver outras apresentações abertas pelo usuário.
    if ($ppt.Presentations.Count -eq 0) { $ppt.Quit() }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($ppt)
}

Write-Output $Saida
