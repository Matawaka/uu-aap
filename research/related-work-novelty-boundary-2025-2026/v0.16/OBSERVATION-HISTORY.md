# v0.16 observation history

Initial head `175e6672f141dfddcd5239b2248ce7a6b68874ad`, run `34231882415`.
A job `102079803389`, B job `102079803423`. Both first artifacts were downloaded,
SHA-256/CRC verified, and their single result member compared byte-for-byte.

Observed failure: `TypeError: Object of type function is not JSON serializable`,
at observer stage `adapter_construction_0`. There was one actual upstream
process_docs call during Task construction and no request-building calls. The
prior environment and adapter replays completed; this was our configuration
snapshot failure, not an environment regression or request compatibility result.

Exact failure JSON: 1501 bytes, SHA-256
`33288cbb687252adb20b1e0a8df4a3716f645dc9a045b04410e79e32685dcad9`.
Stored unchanged in history/initial-observer-serialization-nonpass.json.

Initial A artifact `10058208706`: 792-byte ZIP, SHA-256
`0d51641106d30464cd07e1e96874639ecfe3da31f11156d2a7e2face61531973`.
Initial B artifact `10058218556`: 792-byte ZIP, SHA-256
`bf23aa9223f1e51f5c06b40f13c717337f53ffa8b0b9d968b0a5ac141e5a1afa`.

The observer correction replaces generic JSON serialization of dump_config with
an in-process recursive snapshot of dataclass fields and typed collection/scalar
values. Callable identity is compared before/after, never serialized as runtime
addresses in durable evidence. An additional test covers nested callables,
replacement, unsupported objects and bool/int distinctions.

No upstream code, adapter, dependency profile, request flags, data, description,
expected request hash or acceptance criterion was changed. The initial failure is
not rewritten or counted as successful request execution. Draft/open; no merge.
