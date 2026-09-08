# v0.15 initial route and explicit successor

Initial candidate `85adf080c5884851515a2837d6d087cadf95dd96`, run
`34227210796`, A job `102064147803`, B job `102064147540` completed the
full v0.14 replay but failed in adapter_construction_0. Actual exception:

```text
TaskConfig.__init__() got an unexpected keyword argument 'group'
```

The 1266-byte result is preserved verbatim in
`history/initial-adapter-group-nonpass.json`, SHA-256
`e81c1766087db8e51cd457f997a543b48066dbb3385dfcd0f69e93114e69e882`.
Both artifact APIs reported 736-byte archives with SHA-256
`588f5de352983b921bed6c3e20970cd99f30f06c590315d8bff39248bc3ae9d4`.
A artifact: 10056265539. B artifact: 10056265251.

This is an adapter-route failure, not a failure of the selected environment,
not a model result, and not a reclassification of the unchanged upstream Task.
The initial route fed a full inline group dict through TaskManager.load; the
pinned factory propagated group-level override keys to the inline TaskConfig.

The explicit successor constructs the leaf first through public TaskManager.load
with no group key, then calls public Group.add on that same Task object, and
returns it through TaskManager.load(Group). The Group implementation is bound
to source blob 9f210f883e63d62b59c4f39b6c525d75735ece8f. This route is
recorded in config-delta.json. Its standalone callback accepts exactly the
adapter identity and the factory-generated config_source=inline. No unbounded
caller arguments are ignored.

All original data/function/hash/count/formatting expectations and non-effects
remain unchanged. No source/lock/site-package repair, retry ordering trick, or
rewriting of the initial result is used. A new candidate must independently
execute both lanes again; the first failure is not relabelled as PASS.
