$rows = @()
foreach ($t in @(-6.0,-5.0,-4.0,-3.0,-2.0)) {
  foreach ($rh in @(0,-8,-14)) {
    foreach ($w in @(1.2,1.8)) {
      foreach ($s in @(-80,-180)) {
        $body = @{ temperature = 38.4+$t; humidity = 44.0+$rh; wind_speed = 3.2+$w; solar_radiation = 640.0+$s } | ConvertTo-Json
        $r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/simulate" -Body $body -ContentType "application/json"
        $d = @{}; $r.wards | ForEach-Object { $d[$_.risk_level] = 1 + ($d[$_.risk_level]) } 
        $dist = (@("LOW","MODERATE","HIGH","EXTREME") | ForEach-Object { if ($d[$_]) { "$_=$($d[$_])" } }) -join " "
        $top = ($r.wards | Sort-Object -Property risk_score -Descending | Select-Object -First 3 | ForEach-Object { "$($_.ward_id):$([math]::Round($_.risk_score,0))" }) -join " "
        $rows += New-Object PSObject -Property @{ Dist=$dist; T=$t; RH=$rh; W=$w; S=$s; Top=$top }
      }
    }
  }
}
$rows | Sort-Object Dist | ForEach-Object { "t={0,5} rh={1,4} w={2,3} s={3,4} -> {4,-30} | {5}" -f $_.T,$_.RH,$_.W,$_.S,$_.Dist,$_.Top }
