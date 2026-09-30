$cands = @(
  @{ name="normal";            t=33.9; rh=36; w=4.6; s=480; e=1.0; wkr=1.0; p=1.0 },
  @{ name="high_heat";         t=36.4; rh=42; w=4.2; s=580; e=1.0; wkr=1.0; p=1.0 },
  @{ name="extreme_heat";      t=42.8; rh=59; w=2.4; s=790; e=1.0; wkr=1.0; p=1.0 },
  @{ name="extreme_vulnerable";t=42.8; rh=59; w=2.4; s=790; e=1.3; wkr=1.25; p=1.15 }
)
foreach ($c in $cands) {
  $body = @{ temperature=$c.t; humidity=$c.rh; wind_speed=$c.w; solar_radiation=$c.s; elderly_scale=$c.e; outdoor_worker_scale=$c.wkr; population_density_scale=$c.p } | ConvertTo-Json
  $r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/simulate" -Body $body -ContentType "application/json"
  $d = @{}; $r.wards | ForEach-Object { $d[$_.risk_level] = 1 + $d[$_.risk_level] }
  $dist = (@("LOW","MODERATE","HIGH","EXTREME") | ForEach-Object { if ($d[$_]) { "$_=$($d[$_])" } }) -join " "
  $top = ($r.wards | Sort-Object -Property risk_score -Descending | Select-Object -First 3 | ForEach-Object { "$($_.ward_id):$([math]::Round($_.risk_score,0))" }) -join " "
  "{0,-20} -> {1,-30} | top {2}" -f $c.name,$dist,$top
}
