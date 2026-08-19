import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Custom root HTML for the Expo web / PWA export (CLAUDE.md #11 — native, edge-to-edge).
// This file is server-rendered ONCE at export time and wraps every web page. It is the
// ONLY place to reach the <head>, so it carries: the cover viewport (so the page paints
// under the notch + home indicator and `env(safe-area-inset-*)` becomes non-zero),
// the iOS/Android standalone PWA metas (Add to Home Screen runs full-screen, no browser
// chrome), the manifest, and the CSS that pins the app to the dynamic viewport height so
// it never letterboxes into a "box" the way the default export did.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover is the switch that makes env(safe-area-inset-*) real. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />

        {/* Installed-PWA standalone (iOS + Android) — run full-screen like a native app. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* black-translucent = content draws UNDER the status bar; the notch inset is then
            handled by our safe-area padding, so nothing is clipped. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Kaenal" />
        <meta name="application-name" content="Kaenal" />

        {/* Theme colour tracks the OS scheme so the system bars match the app surface. */}
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />

        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-1024.png" />
        <link rel="icon" href="/favicon.png" />

        {/* Keep RN-Web scroll behaviour consistent (expo-router default). */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: nativeShellCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Pin the app to the *dynamic* viewport height (100dvh handles iOS Safari's collapsing
// toolbars) and kill page-level scroll/overscroll so only in-app ScrollViews move — the
// difference between "a web page in a box" and "a native app". The safe-area insets are
// left to react-native-safe-area-context (now non-zero thanks to viewport-fit=cover),
// which the Header / TabBar / Body already consume.
const nativeShellCss = `
html, body { margin: 0; padding: 0; }
html, body, #root {
  height: 100%;
  height: 100dvh;
}
body {
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-tap-highlight-color: transparent;
  background-color: #ffffff;
}
@media (prefers-color-scheme: dark) {
  body { background-color: #09090b; }
}
#root {
  display: flex;
  flex-direction: column;
}
/* Suppress the pull-to-refresh / rubber-band on the shell itself. */
* { -webkit-overflow-scrolling: touch; }
`;
