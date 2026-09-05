# Witness Operator Attribution Topology v0.1

Tracking issue: #941.

This additive interoperability probe starts from the exact accepted #940 same-run seven-key receipt and asks a narrower descriptive question: **which public operator labels are currently associated with the six witness/about surfaces carrying the seven exact #934 witness pins?**

## Admitted topology

The closed profile requires:

- `Mullvad VPN AB` → `https://witness.stagemole.eu/about` → one exact pin;
- `TrustFabric` → `https://transparency.dev/witnesses` → two exact pins;
- `Florian Larysch` → `https://remora.n621.de/` → one exact pin;
- `Geomys` → `https://geomys.org/witness/navigli` → one exact pin;
- `rgdd` → `https://www.rgdd.se/poc-witness/about` → one exact pin;
- `Elias Rudberg` → `https://witness1.smartit.nu/witness1/about.txt` → one exact pin.

The current Witness Network table at `https://witness-network.org/witness-tables/` is treated only as `NETWORK_CURATED_OPERATOR_TABLE`. A registry relation counts only when the expected operator label and expected about URL occur in the **same HTML table row**. Mere presence elsewhere in the page does not bind them.

The direct about surfaces are independently fetched read-only and must contain all exact pins assigned to the corresponding public label. Strong admission therefore composes two observations: current direct key material and current network-curated label/about attribution.

Expected bounded topology:

```text
7 exact #934 witness pins
        ↓
6 direct witness/about surfaces
        ↓
6 public operator labels
```

`TrustFabric` is deliberately one public label for two exact pins; it must never be inflated into two independent operators.

## Strongest permitted result

```text
ALL_SEVEN_PINNED_WITNESS_KEYS_BOUND_TO_SIX_PUBLIC_OPERATOR_LABELS_LEGAL_IDENTITY_CONTROL_AND_INDEPENDENCE_NOT_ESTABLISHED
```

This is an attribution-topology observation only. In particular:

```text
public operator label != legal identity
public operator label != cryptographic identity binding
about-page control != legal entity control
network-curated attribution != operator self-attestation
6 distinct labels != 6 independent organizations
7 keys != 7 operators
operator attribution != current key activity
operator attribution != non-equivocation
operator attribution != C2PA completeness
attribution/provenance != truth
attribution/provenance != authority
Trigger != Authorization
```

All identity, legal-identity, control, independence, current-activity, non-equivocation, complete-history, C2PA-completeness, trusted-time, truth, authority, canonicality, maliciousness and remediation claims remain fail-closed `false`.

## Effects

The workflow is repository-read-only (`contents: read`) and performs HTTPS GET only. It does not call witness `POST /add-checkpoint`, mutate witness/log state, rotate keys, submit OTS material, create Bitcoin transactions, post upstream, alter Core/SPEC/Registry, release/tag, or trigger remediation.
