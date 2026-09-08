# v0.15 first completed adapter observation and qualification boundary

The first complete A/B pair ran at `71aeeade1450e11aaeb8b0b1d90c372f23733e1c`
in run `34227917879`. Both jobs succeeded, including namespace checks after
adapter execution. Their 19 downloaded evidence members match byte-for-byte.
The exact 3238-byte result has SHA-256
`f83a8be7bb64ed2b8950641c44c7944cbc317f776c1683a043b739168f1605f6`.

The current adapter route constructs a leaf through public TaskManager, adds the
same Task to a public Group, and returns the group through TaskManager again.
It does not send group keys through TaskConfig. The initial inline-group failure
remains in history, with its actual error and hash; OBSERVATION-HISTORY.md records
the explicit route correction. The README describes the original candidate plan;
this status and the observed config-delta distinguish the corrected public route.

Each job executed two fresh adapter instances, each with one exact raw dataset
load and two upstream process_docs calls. A real Task contains all 251 documents,
matching all 209 source HF rows and the prior full document and formatting hashes.
The after-adapter installed namespace and public import evidence match v0.14.
Original upstream Task compatibility remains NONPASS.

The first result, configuration delta, member manifest and first-pair receipt
are frozen here. An independent successor qualifies only after BOTH of its
predeclared A/B jobs execute the unchanged adapter/gate/replay code and pass the
unconditional fresh-evidence validator. Existing result files are never copied
into the new adapter runtime output as substitutes for execution. The predecessor
folder in each artifact contains newly executed prior probes, not fabricated
history. All six repository workflows must be checked on the same final SHA.

This is named-adapter construction and doc_to_text/doc_to_target compatibility,
not full original-task, request-construction, generation or scoring equivalence.
The original description still mentions decision accuracy, but scoring is disabled.
No model, provider API, user credentials, request construction/dispatch, score,
novelty, production, release, standards, main mutation or merge authority.

Next separate boundary: model-free request construction and request-content
fidelity, including description and generation arguments, still without dispatch,
model weights or scoring. No such request has been constructed in v0.15.
