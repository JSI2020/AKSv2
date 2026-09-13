# Pakistani womenswear sizing research pack

Source files from field research (Aug 2026). Regenerate app seeds after editing CSVs:

```bash
npm run db:generate:sizing-research
npm run db:import:sizing-research -- --force-rows
```

## Files

| File | Use in app |
|------|------------|
| `Categories.csv` | Garment categories + measurement key sets |
| `Measurement_Keys.csv` | Measurement key catalogue |
| `Raw_Size_Observations.csv` | **Evidence only** — drives research-backed default charts for measured categories |
| `Fabric_Observations.csv` | Unstitched fabric quantity evidence |
| `Sources.csv` | Citation URLs and interpretation notes |
| `README.csv` | Import rules and taxonomy status |
| `Pakistani_Womenswear_Research_Data_Pack.xlsx` | Master workbook (same data) |

## What gets imported

- **35 categories** (34 research + legacy `SHIRT` alias)
- **41 measurement keys**
- **5 research-backed default size blocks**: KURTI, PANT, PALAZZO, LEHENGA, KAMEEZ
- **Placeholder blocks** for remaining categories (Confirmed / Proposed)

Do not treat `Raw_Size_Observations.csv` as universal house standards — it records cited brand charts with mixed body vs finished-garment basis.
