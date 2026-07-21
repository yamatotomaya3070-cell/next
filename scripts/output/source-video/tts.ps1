
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 manifest.json | ConvertFrom-Json
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $synth.SelectVoice('Microsoft Haruka Desktop') } catch { }
$synth.Rate = 0
foreach ($item in $items) {
  $synth.SetOutputToWaveFile($item.wav)
  $synth.Speak($item.text)
}
$synth.SetOutputToNull()
$synth.Dispose()
