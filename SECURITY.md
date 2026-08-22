# Security, Privacy and Coercion Model

## What cryptography can establish

Cryptographic binding can show that:

- a manifest was signed by a key;
- an artifact matches a recorded digest or standards-based binding;
- a signed record existed before or at a recorded event;
- a later version differs from a prior signed edition.

It cannot establish that:

- the signer told the truth;
- every AI system was disclosed;
- a named human personally performed every declared action;
- a work is factually correct;
- copyright ownership is valid;
- a listed source is trustworthy.

## Primary threats

1. False self-declaration.
2. Stolen or delegated signing credentials.
3. Undisclosed model/tool use.
4. Fabricated decision traces.
5. Misleading reviewer scope.
6. Edition substitution.
7. Link rot and evidence loss.
8. Coercive demands for complete prompt histories.
9. Employer/school surveillance disguised as provenance compliance.
10. Reputation scoring based solely on AI participation.
11. Over-centralized registry governance.
12. Forced certainty where evidence is incomplete.

## Privacy requirements

Reference implementations SHOULD:

- separate public and private evidence stores;
- store hashes instead of raw prompts where practical;
- support selective disclosure;
- avoid biometric typing evidence;
- avoid continuous screen capture requirements;
- permit redaction categories;
- support key rotation and correction;
- avoid publishing confidential source material by default.

## Coercion resistance

A provenance protocol can become harmful if a powerful institution turns optional transparency into mandatory surveillance.

Therefore UU-AAP ordinary conformance MUST NOT require:

- keystroke biometrics;
- liveness monitoring;
- continuous recording of the author;
- complete prompt transcript disclosure;
- proof that AI was absent.

High-assurance specialized deployments MAY define additional evidence outside UU-AAP, but MUST NOT describe those additions as baseline UU-AAP requirements.
