# Findings

## Existing protections

- Recommendation queries only select `status = 'available'`; the map view excludes soft-deleted plots.
- Agent-selected plot IDs must match recommendation metadata in the same conversation.
- Plot status is rechecked before the confirmation summary.
- Final reservation creation locks plot rows with `FOR UPDATE`, rechecks availability, and atomically moves them to `pending`.

## Known gaps

- `fn_release_expired_reservations()` exists in `DBase.sql`, but the repository does not schedule or invoke it.
- A user-typed plot code is only matched against recent recommendations; unavailable codes do not receive a status-specific explanation or alternatives.
- The final create path recalculates current DB prices but does not compare them with the amount the user confirmed.
- Tests cover a generic unavailable `pending` plot but not each unavailable status or a realistic stale/concurrent flow.
- User reports that clan/family requests currently return ordinary single plots and advice is too brief.

## Audit details

- `PlotRecommendationService` already supports grouping 2–10 plots and adjacency, but defaults to one plot whenever `numberOfPlots` is absent.
- The current deterministic extraction only recognizes explicit numeric counts/adjacency phrases; no explicit family/clan semantic default was found.
- The orchestrator already asks the model for reasons, a trade-off, and alternatives, but the fallback emphasizes only the strongest option; comparison needs to become a first-class grounded section.
- Nest scheduling is already enabled globally, so expired-hold cleanup can use `@nestjs/schedule` without adding a package.
- Planner schema already has `plotType: family` and describes family plots as adjacent, but it does not enforce a multi-plot count. The deterministic Vietnamese extractor also has no family/clan branch.
- The current prompt correctly avoids inventing an unknown plot count. Desired behavior should therefore be: recognize family/clan intent, require adjacency, and ask for intended capacity/count before searching unless the customer explicitly delegates the choice.
- Recommendation output already carries per-option reasons and trade-offs, so richer comparison can remain fully grounded without changing the frontend payload shape.
- Root cause of the reported clan bug is now clear:
  - deterministic extraction recognizes `gia đình`/`dòng họ` but not `dòng tộc`;
  - when an adjacent multi-plot search returns zero results, the orchestrator deliberately falls back to single plots;
  - strict `plotType=family` filtering can also hide valid adjacent groups of ordinary plot records.
- The planner output currently replaces deterministic extraction after NVIDIA planning. Family/clan constraints need a deterministic normalization step before validation/tool execution.
- The deterministic fallback text lists alternatives but does not compare price deltas, area, direction, adjacency, or trade-offs side by side.
- Live inventory confirms the data model has dedicated family plots: 28 available `single`, 2 available `double`, and 6 available `family` records. Therefore “lô dòng tộc” should first map to `plotType=family`; it does not always require multiple plot rows.
- For family/clan intent with an unknown count, the discovery question should distinguish one dedicated family plot from a requested cluster of several adjacent plots.
- A family/clan search must never silently degrade to an ordinary single plot. If dedicated family inventory has no match, the Agent may offer an adjacent multi-plot alternative only when it clearly explains the relaxation.

## Implementation design

- Add a Nest cron in `ReservationsService` that runs every minute and on startup, cancels expired pending/submitted requests, and safely releases only plots with no other active request.
- Persist the price shown in the Agent confirmation as `quotedTotal`. Recheck availability and price on confirmation, require reconfirmation after a price change, and compare again inside the row-locking transaction.
- Keep the conversation-recommendation allowlist for UI actions. For a user-typed exact plot code, perform an authoritative DB lookup; allow an available plot and return a status-specific refusal plus nearby available codes for unavailable plots.
- Merge deterministic Vietnamese extraction over the NVIDIA plan for explicit current-turn constraints. Recognize `dòng tộc`, `gia tộc`, and `khu mộ họ` as family intent.
- Remove the automatic multi-plot-to-single fallback whenever family type or explicit adjacency is active.
- Expand both model prompt and deterministic fallback into a grounded top-3 comparison with price difference, area, direction, adjacency/type, reasons, and trade-offs.
- There is no existing orchestrator spec. Add a small exported deterministic requirements helper so family/clan phrase behavior can be tested without constructing the full orchestrator dependency graph.
- Live smoke test after restart returned HTTP 201 with three recommendations, all `plotType=family` (`C-02-003`, `C-02-001`, `C-02-002`), comparison language, and map/request actions for every option.
- The live deterministic response exposed one stale phrase, “tạo yêu cầu nháp”; it was corrected to “đặt yêu cầu”.
