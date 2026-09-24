#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Extract the exact animation inputs from the delivered reference PNG, locally."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import zlib
import numpy as np
from PIL import Image

REFERENCE_SHA256 = '90ed6871efde5f5348c4985a5d7ef3c77c219664cd3eeba8548e5cc10255d8aa'
EXPECTED_MASKS = {
    'eye': '5d3c3ecf3cc59a07b158a9b3552a86d471daf3f1f0ba193e650ee51e9e55973c',
    'letters': '918a7ceccb272239a5dde30f0dbb695cec5a07b45ff577d588befbf2ecabd7b0',
}


def extract(reference: Path, output: Path) -> None:
    if hashlib.sha256(reference.read_bytes()).hexdigest() != REFERENCE_SHA256:
        raise ValueError('Reference is not the exact approved input image')
    with Image.open(reference) as im:
        if im.size != (1254, 1254):
            raise ValueError('Reference dimensions changed')
        src = np.array(im.convert('RGB'))
    eye = np.rint(np.clip((235-src[593:907, 258:600].min(2).astype(float))/155, 0, 1)*255).astype('uint8')
    letters = np.rint(np.clip((src[367:516, 306:940].min(2).astype(float)-30)/225, 0, 1)*255).astype('uint8')
    data = dict(schema='uu-verified-artwork-masks/v0.1', referenceSha256=REFERENCE_SHA256,
                referenceSize=[1254, 1254], encoding='base64(zlib(row-major uint8 alpha))',
                description='Exact extracted artwork masks, not font files.')
    for name, mask in [('eye', eye), ('letters', letters)]:
        raw = mask.tobytes()
        digest = hashlib.sha256(raw).hexdigest()
        if digest != EXPECTED_MASKS[name]:
            raise ValueError(f'{name}: unexpected extracted mask')
        data[name] = dict(shape=list(mask.shape), rawSha256=digest,
                         zlibBase64=base64.b64encode(zlib.compress(raw, 9)).decode('ascii'))
    output.mkdir(parents=True, exist_ok=True)
    for name, mask in [('eye', eye), ('letters', letters)]:
        Image.fromarray(mask).save(output/f'{name}-mask.png')
    (output/'artwork-masks.json').write_text(json.dumps(data, indent=2)+'\n', encoding='utf-8')
    print('Exact alpha masks extracted; no font files or remote services used.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    extract(args.reference, args.output)
