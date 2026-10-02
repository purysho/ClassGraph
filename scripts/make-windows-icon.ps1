param(
  [Parameter(Mandatory = $true)]
  [string]$Output
)

Add-Type -AssemblyName System.Drawing

$size = 256
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$indigo = [System.Drawing.ColorTranslator]::FromHtml('#4f46e5')
$white = [System.Drawing.Color]::White
$backgroundBrush = New-Object System.Drawing.SolidBrush($indigo)
$whiteBrush = New-Object System.Drawing.SolidBrush($white)

$radius = 56
$diameter = $radius * 2
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc(0, 0, $diameter, $diameter, 180, 90)
$path.AddArc($size - $diameter, 0, $diameter, $diameter, 270, 90)
$path.AddArc($size - $diameter, $size - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc(0, $size - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()
$graphics.FillPath($backgroundBrush, $path)

$font = New-Object System.Drawing.Font(
  'Arial',
  94,
  [System.Drawing.FontStyle]::Bold,
  [System.Drawing.GraphicsUnit]::Pixel
)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRect = New-Object System.Drawing.RectangleF(12, 58, 232, 120)
$graphics.DrawString('CG', $font, $whiteBrush, $textRect, $format)

$pen = New-Object System.Drawing.Pen($white, 9)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($pen, 90, 193, 166, 193)

$directory = Split-Path -Parent $Output
if ($directory) {
  New-Item -ItemType Directory -Force $directory | Out-Null
}

$handle = $bitmap.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($handle)
$stream = [System.IO.File]::Create($Output)
try {
  $icon.Save($stream)
} finally {
  $stream.Dispose()
  $icon.Dispose()
  $pen.Dispose()
  $format.Dispose()
  $font.Dispose()
  $whiteBrush.Dispose()
  $backgroundBrush.Dispose()
  $path.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
