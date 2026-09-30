import app.main  # noqa: F401  ensure providers initialised
from app.services.risk import RiskService
from app.services.data_layer import DataLayer
svc = RiskService(DataLayer())

def dist(sc):
    d = {}
    for w in svc.all_wards_from_scenario(sc):
        d[w["risk_level"]] = d.get(w["risk_level"], 0) + 1
    return d

def fmt(d):
    order = ["LOW","MODERATE","HIGH","EXTREME"]
    return " ".join(f"{k}={d.get(k,0)}" for k in order if d.get(k,0))

rows = []
for t in (-6.0,-5.0,-4.0,-3.0,-2.0):
    for rh in (0.0,-8.0,-14.0):
        for wd in (1.2,1.8):
            for s in (-80.0,-180.0):
                sc = dict(temp=t, humidity=rh, wind=wd, solar=s,
                          elderly_scale=1.0, worker_scale=1.0, pop_scale=1.0, label="x")
                wards = svc.all_wards_from_scenario(sc)
                d = dist(sc)
                top = " ".join(f"{x['ward_id']}:{x['risk_score']:.0f}" for x in sorted(wards, key=lambda w:-w["risk_score"])[:3])
                rows.append((fmt(d), t, rh, wd, s, top))
for d, t, rh, wd, s, top in sorted(rows, key=lambda r: r[0]):
    print(f"t={t:5.1f} rh={rh:6.1f} w={wd:4.1f} s={s:6.0f} -> {d:30s} | {top}")
