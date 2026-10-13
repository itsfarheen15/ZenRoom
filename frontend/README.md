# Frontend

Next.js App Router with JavaScript/JSX. Follow the [root setup guide](../README.md) for the complete Docker stack and your own credentials. See [Contributing](../CONTRIBUTING.md) for host development, lint/build and browser checks.

`NEXT_PUBLIC_DJANGO_API_URL` defaults to `http://localhost:8000/api`. Provider keys stay in Django. The browser exchanges a Django token for an HttpOnly session; it does not store long-lived API tokens. Alias `@/*` is defined in `jsconfig.json`.

Browser tests use installed Google Chrome and mocked API data by default. `ZEN_LIVE=1` enables the Docker-backed real-session test. The original `src/components/light-tunnel.jsx` uses Canvas 2D and carries the project MIT grant. See [third-party notices](../THIRD_PARTY_NOTICES.md).

## Original galaxy background

`LightTunnel` in `src/components/light-tunnel.jsx` retains its export name for the dashboard integration. It now draws a scattered star field, cached violet/teal nebula glows and staggered falling meteors with Canvas 2D. Mouse/pen movement adds eased parallax capped at 8px horizontally and 6px vertically; it does not bend or repel stars. Meteors follow independent straight paths.

The component accepts `paused` (default false) and `className`. The dashboard mounts it only in Dark mode behind interactive content. It observes reduced motion, suspends animation in hidden tabs, ignores touch movement and caps pixel ratio at 1.5. Mobile uses fewer stars/meteors. No graphics package or external assets are required.

The component and its original CSS are covered by the root MIT license. Keep the SPDX/copyright header when reusing it.
