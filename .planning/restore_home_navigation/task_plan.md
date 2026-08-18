# Restore the original Home navigation visual language

## Goal
Keep the role-aware shared navigation behavior, but restyle every header navigation to match the original Home design: plain centered text links without pill/card borders or backgrounds. Replace the Home hero eyebrow with one clear centered Vietnamese line in an easy-to-read font.

## Phases
- [completed] Confirm the exact current shared-nav and hero-eyebrow styles introduced in the prior change.
- [completed] Restore the original Home text-link styling in the shared component and center it consistently in customer/admin headers.
- [completed] Simplify the hero eyebrow to Vietnamese-only copy with readable typography and centered alignment.
- [completed] Run focused tests, build/lint checks, diff audit, and visual smoke checks.

## Constraints
- Keep the Admin destination visible only when `role === "admin"`.
- Keep route guards and backend untouched.
- Remove pill/card borders and backgrounds; reproduce the old Home nav visual language.
- Navigation remains centered and responsive.
- Hero eyebrow contains Vietnamese only, uses an easy-to-read font, and stays centered.

## Errors

| Error | Attempt | Resolution |
|---|---:|---|
| context-mode runtime is not registered in this session | 1 | Use guaranteed-small bounded inspections and focused test commands, recording results frequently. |
| PowerShell `New-Item` was called with unsupported `-LiteralPath` during screenshot setup | 1 | Chrome still created the explicit temporary profile/output path; use the generated screenshot directly and use `-Path` for any later creation. |
