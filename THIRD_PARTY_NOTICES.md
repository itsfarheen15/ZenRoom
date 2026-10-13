# Third-party notices and license scope

The root [MIT license](LICENSE) covers original Developer Zen Room code and documentation. It does not replace third-party licenses or grant rights to provider content. MIT reference: [Open Source Initiative](https://opensource.org/license/mit).

## Original light tunnel and removed legacy effect

`frontend/src/components/light-tunnel.jsx` is an original Canvas 2D implementation written on 2026-10-13 under the root MIT grant, with an SPDX identifier and project copyright notice. Its current galaxy variation uses scattered stars, nebula gradients, straight falling meteors and gentle pointer parallax. No React Bits implementation was opened or copied while writing this replacement. It is not a port of the removed shader.

The former `lightfall/Lightfall.jsx` and its CSS have been removed, together with the unused OGL dependency. The old component's source comment attributed it to React Bits but lacked a verifiable source revision/license. The current tree no longer distributes that source. Existing Git history may still contain it; replacing files does not relicense or erase earlier commits. Review historical distribution before publishing; no history rewrite was performed.

## Dependencies and assets

Node dependencies are declared in `frontend/package.json` and resolved in `frontend/package-lock.json`; Python dependencies are pinned in `backend/requirements.txt`. Each dependency and transitive dependency retains its own license. Preserve license files in installed packages and distributions. Review licenses again when changing dependency versions; this document is not a complete dependency license audit.

Geist and Geist Mono arrive through the `@fontsource-variable` packages. Their font license files remain in those packages. Lucide icons, React, Next.js and other libraries retain their own upstream notices. Docker images include additional operating-system packages with separate licenses.

`docs/hero.png` is a screenshot of this application using fictional browser-test fixtures. It depicts the original MIT galaxy background. News articles, publisher marks, GitHub repository names and external site assets remain the property of their respective owners. The project license does not cover those materials or provider API access.
