# UU verified animation — visual materials v0.1

**Artwork only. Not an issued attestation, live status indicator or action permission.**

[Русский](README.ru.md) · Concept backlog [#1000](https://github.com/Matawaka/uu-aap/issues/1000) · Concept PR [#1001](https://github.com/Matawaka/uu-aap/pull/1001)

## Publication status

The GitHub branch contains the source scripts, timing, manifest, build report and documentation. **Binary asset transfer is not completed. The GIF, MP4, reference PNG and pixel-mask inputs must not be described as already committed.** A transfer attempt for the input-data package was blocked by the tool. No binary-upload workflow, external upload service, release or automatic merge was used.

The complete delivery archive supplied in the conversation contains the exact files listed in `artifact-manifest.json`, including both GIFs, MP4, original reference, exact alpha masks, previews and sources. The manifest describes that archive; it does not prove the listed files are present in this Git tree. After importing them, run the verifier before changing this publication status.

## Delivered animation

| File in delivery package | Properties |
| --- | --- |
| `UU_verified.gif` | 768 x 768; 16.5 s; endless loop; 530 encoded frames; 3,467,299 bytes |
| `UU_verified_once.gif` | 768 x 768; 15.5 s; no loop extension; 481 encoded frames; 3,137,659 bytes |
| `UU_verified.mp4` | 768 x 768; 16.5 s; 50 fps; 435,004 bytes |
| `UU_verified_final.png` | Settled final pose, 768 x 768; static/reduced-motion alternative |
| `source/reference.png` | Exact selected image used for shape extraction, 1254 x 1254 |
| `source/artwork-masks.json` | Exact reusable eye and eight-letter alpha-mask inputs; not font files |

The GIF uses variable frame delays and combines identical frames. It is not a 530-fps animation. Both U eyes reuse one shape. Each lowercase letter of `verified` drops and recoils separately; later letters send strongly damped impulses to earlier neighbours. All glyphs are clipped to the capsule. The capsule temporarily contracts during the position swap while the elastic U shapes yield sideways and descend. See `timeline.json`.

## Reproduce locally

Use the complete package, or import its missing assets into this directory. From this directory:

```sh
python -m venv .venv
# Activate .venv using your operating system's usual command.
python -m pip install -r source/requirements.txt
python source/verify_package.py
python source/build_animation.py --output rendered --video --require-exact
```

Cairo native libraries are required; FFmpeg is required only for `--video`. The successful local environment is recorded in `artifact-manifest.json`: Python 3.13.5, Debian 13, Cairo 1.18.4, pixman 0.44.0 and FFmpeg 7.1.5, with the listed Python packages. Package pins alone do not fix every platform/library detail. `--require-exact` refuses different GIF bytes; do not silently replace a delivered asset after a mismatch.

To reconstruct the inputs from the exact reference PNG:

```sh
python source/extract_masks.py source/reference.png
```

To export all 825 uniformly sampled PNG frames, including holds:

```sh
python source/build_animation.py --output rendered-frames --frames --require-exact
```

`build_animation.py` is a portable adaptation of the actual previous generation script, not a claim that the original container-specific source file is unchanged. Motion formulas, artwork masks, palette and GIF encoding are preserved. Local reproduction matched **both delivered GIF SHA-256 values and the delivered MP4 SHA-256**; see `local-build-report.json`. This is a local repeat, not independent review or GitHub CI success.

## Origin, licensing and use boundary

The user selected the visual direction and detailed motion sequence in the project conversation. The reference artwork was generated in that conversation; deterministic code extracted its shapes and animated them. No font files are included or needed for the logo lettering.

Existing repository licensing applies: non-software artwork/documentation under the repository's CC BY 4.0 default, source code under Apache-2.0, subject to existing specific notices. See the repository `LICENSE.md` and `NOTICE.md`. No new trademark, endorsement or issuer rights are granted by this asset package; no registration or ownership determination is claimed.

This decorative animation does not read an evidence record, verify a profile, query revocation status or issue a credential. A production interface must not substitute animation playback or its final word for an actual current verification result. Keep the distinction between brand demonstration and a scoped, evidence-backed status. Offer a static alternative where motion is inappropriate.
