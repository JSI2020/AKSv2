# AKS documentation

| Doc | Use when |
|---|---|
| [`AKS_Brand_Foundation.md`](./AKS_Brand_Foundation.md) | Writing any customer-facing copy or voice |
| [`AKS_Brand_Concept_Roadmap.md`](./AKS_Brand_Concept_Roadmap.md) | Merchandising, fashion palette, launch phases, hold-the-line rules |
| [`AKS_Design_And_Sizing_Unified.md`](./AKS_Design_And_Sizing_Unified.md) | Size system / studio sizing |
| Tier / admin prompts | Only when the current build step names them |

Read docs when the current step references them — do not invent ahead of the roadmap.

## Photoreal (admin sketch tool)

Separate from Design Studio (`modules/ai/studio`). After pulling schema changes:

```bash
npm run db:ensure:photoreal
npm run db:seed   # seeds photoreal.view / generate / edit permissions
```

Admin route: `/admin/photoreal` (requires `photoreal.view`).
