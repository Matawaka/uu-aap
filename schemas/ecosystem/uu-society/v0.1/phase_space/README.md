# UU Society phase-space exploration v0.2

A bounded **3 × 3 × 3 × 2 = 54-run** deterministic factorial sweep over adversarial prevalence, willingness to share, and containment duration. All other parameters remain fixed at the P00 synthetic baseline.

## Reproducibility and interpretation

- SHA-256-derived seed streams, same replicate seed across parameter cells.
- Exact replay compares all run rows and the full summary, including trace hashes.
- Per-cell persistent signals are the intersection across seeds; observed signals are the union. Divergence is reported rather than hidden.
- Each cell reports separate harm, unmet need, restriction, access and provider concentration metrics. No scalar social goodness objective.
- Diagnostic thresholds are inherited from the P00 fixture and are **hypotheses**, not learned thresholds or ethical judgments.
- This is a *synthetic* factorial study, not evidence that real societies have these transitions.
- In particular, provider-action concentration is **not** proof of concentration of legal or institutional authority.
- The baseline currently has no finite shared-resource inventory, resource depletion, endogenous actor adaptation, demographic turnover or victim-level harm severity. These are explicit future model limitations.

Run:

```bash
python schemas/ecosystem/uu-society/v0.1/harness/run_phase_space.py --check-replay --write
```

The generated JSON artifacts are local CI outputs, not governance receipts and do not confer runtime authority.

## Русский

Исследование пространства параметров: 54 воспроизводимых прогона с изменением доли adversarial actors, готовности делиться и длительности containment. Результат — карта совместно возникающих диагностических сигналов, а не универсальный рейтинг общества или людей. Совпадение двух seed не является доказательством устойчивости в реальном мире. Сигналы могут сосуществовать, а расхождения между seed фиксируются явно.
