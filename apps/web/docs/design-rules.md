# Frontend Design Fidelity — Non-Negotiable Rule

## The rule

Any `*.jsx` file under `project_brain/project/src/` (and `project_brain/project/Kaenal.html`)
that depicts a screen is the **authoritative, binding visual design** for that screen. When you
build or change that screen, the built result MUST match the jsx **pixel-for-pixel**: the same
layout, grid, spacing, padding, element sizes, typography (size/weight), colours, border radii,
borders, icons, badges/chips, column sets, ordering, and **every view, sub-view, panel and state**
the jsx shows.

"Close enough", "the core of it", or "a simpler version" is **NOT done**. A screen that diverges
from its jsx is a **defect**, regardless of whether it functions. Fidelity to the jsx is a
**completion gate**: a screen is not finished until it is visually indistinguishable from its jsx.

## Design vs code (how this squares with "never copy prototype code")

CLAUDE.md says never to paste jsx code into the codebase — that still holds. The jsx is a
**throwaway prototype**: inline styles, hardcoded hex, mock data, no real components. You reproduce
the **design it renders**, never its code:

- Match the **pixels** — layout, spacing, sizes, weights, colours, the lot.
- Implement with the **real system** — `styles/tokens.css` variables for colour/type, the shared
  `@/components/ui` primitives, real data via hooks, no business logic in components, no `any`.

Pixel-perfect output, production-grade implementation. The two rules are not in tension: one
governs the **result**, the other the **means**.

## Process — every screen, every time

1. **Read the ENTIRE jsx first.** Before writing a line of FE, open the jsx for the screen AND
   every sub-component/view it references — detail tabs, dialogs, side panels, cards, tool
   builders, and the empty / loading / error states. Never start from a mental model of "what this
   feature probably looks like". The jsx is the source of truth, not your assumption.
2. **Enumerate the surface.** Write down every view, section, sub-panel, affordance and state the
   jsx contains. That list is the build checklist — nothing on it is optional.
3. **Reproduce all of it.** Every panel and control the jsx shows gets built, including the rich
   ones (e.g. the 8D D4 root-cause tool builders — 5-Whys / fishbone / Pareto; AI provenance
   cards; a chargeback breakdown ledger). Do not silently simplify a screen down to its skeleton.
4. **Match the details.** Column sets and their order, chip/badge colours and labels, icon choices,
   section headers, card layouts, grid column counts, paddings, and font sizes/weights are all
   taken from the jsx (colour/type values resolved through `tokens.css`).
5. **Verify against the jsx.** Open the built screen in the browser and compare it side-by-side
   with the jsx. Screenshot it. If they differ in any way that a designer would notice, it is not
   done — fix it before claiming completion.

## When a part genuinely cannot match yet

If a piece of the design depends on a backend that does not exist, or is truly outside the current
change, you MUST **surface it to the user explicitly and get agreement BEFORE shipping** — name the
exact panel/feature and the reason. You may **not** quietly drop it, ship a reduced version, and
call the screen done. Silent divergence is precisely the failure this rule exists to prevent.

## Colour / type note

`tokens.css` is the value source for colours and typography (04 §2's literal palette is superseded
by it — see PROGRESS.md). Where a jsx hardcodes a hex that maps to a token, use the token. Where a
jsx hardcodes a semantic accent the token system doesn't cover (e.g. the Supplier Portal's teal),
reproduce that value locally to the feature — the jsx's intent wins on look.
