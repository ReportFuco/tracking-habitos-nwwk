# Design System: The Curated Life

## 1. Overview & Creative North Star: "The Digital Atelier"
This design system moves away from the cold, clinical nature of traditional tracking apps. Instead, it adopts the persona of a **Digital Atelier**—a space that feels bespoke, warm, and hyper-organized without being rigid. 

The "Creative North Star" is **Mindful Editorial**. We treat user data not as rows in a database, but as entries in a high-end personal journal. We break the "template" look by using intentional asymmetry in layout, generous white space (breathing room), and a hierarchy that relies on tonal depth rather than structural lines. The experience should feel like flipping through a premium architectural magazine: sober, quiet, and deeply intentional.

---

## 2. Colors & Tonal Architecture
The palette is rooted in nature and tactile materials. We use Material Design token conventions but apply them with an editorial sensibility.

### The Foundation
- **Base (Surface):** `#f9faf2` (Warm, off-white paper feel).
- **Primary (Core):** `#42512f` (Deep olive for grounding elements).
- **Secondary (Subtle):** `#486730` (Natural green for accentuation).
- **Tertiary (Warmth):** `#84311f` (Brick/Coral for energetic tracking like workouts).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. 
Boundaries must be created through:
1.  **Background Color Shifts:** Placing a `surface-container-low` component on a `surface` background.
2.  **Tonal Transitions:** Using subtle shifts between `#f9faf2` (background) and `#edefe7` (surface-container).
3.  **Negative Space:** Using the Spacing Scale to create "gutters" of air that act as invisible dividers.

### Module-Specific Signifiers
To help users cognitively map their life, use these "Module Tones" as soft background washes or typography accents:
- **Finanzas:** `primary` (#42512f) - Trust, depth, stability.
- **Nutrición:** `secondary` (#486730) - Vitality, organic growth.
- **Entrenamientos:** `tertiary` (#84311f) - Heat, movement, energy.
- **Compras:** `tertiary_fixed` (#ffdad3) - Lightness, desire.

---

## 3. Typography: The Editorial Voice
We use a dual-font strategy to balance character with extreme legibility.

- **Headlines & Display (Manrope):** A modern sans-serif with geometric foundations. Use `display-lg` (3.5rem) for daily summaries to create an authoritative, "hero" feel.
- **Body & Titles (Manrope):** Provides a clean, rhythmic reading experience.
- **Labels & Metadata (Inter):** A functional workhorse used at `label-md` (0.75rem) for high-density data tracking to ensure clarity at small sizes.

**Editorial Tip:** Use high-contrast scale. Pair a `display-sm` header with a `body-md` description. The "gap" in size creates a premium, designed feel that standardizes the information hierarchy.

---

## 4. Elevation, Depth & Layering
We avoid the "flat" look of 2010s web design by embracing physical metaphors: paper, glass, and light.

### Tonal Layering (The Stack)
Hierarchy is achieved by stacking `surface-container` tiers:
- **Level 0 (Base):** `surface` (#f9faf2) - The "desk" everything sits on.
- **Level 1 (Sections):** `surface-container-low` (#f3f4ed) - Large content areas.
- **Level 2 (Cards/Actions):** `surface-container-lowest` (#ffffff) - Interactive elements that need to "pop" against the warm background.

### The "Ghost Border" & Glassmorphism
- **Ghost Borders:** If a separator is legally or accessibility-required, use `outline-variant` (#c5c8b8) at **15% opacity**. It should be felt, not seen.
- **Glassmorphism:** For floating navigation or modal overlays, use semi-transparent `surface` colors with a `backdrop-filter: blur(12px)`. This allows the "Module Tones" to bleed through, keeping the UI integrated.
- **Ambient Shadows:** Shadows must be "airy." Use the `on-surface` color (#191c18) at 4% opacity with a 24px blur and 8px Y-offset. Never use pure black shadows.

---

## 5. Components & Interface Objects

### Buttons: The Tactile Interaction
- **Primary:** Filled with `primary` (#42512f). Use `md` (0.75rem) rounded corners. Padding should be generous (16px 24px) to feel "weighted."
- **Secondary:** Tonal. Use `secondary-container` (#c9eea9) with `on-secondary-container` text. This provides a soft, non-urgent alternative.
- **Tertiary:** No background. Use `title-sm` typography with a subtle underline or icon.

### Cards & Data Modules
- **Rule:** No borders. No dividers.
- **Layout:** Use `surface-container-highest` (#e1e3dc) for empty states and `surface-container-lowest` (#ffffff) for active data. 
- **Spacing:** Use 24px (xl) internal padding to ensure data "floats" within the card.

### Input Fields: Integrated Minimalism
- **Styling:** Avoid "boxed" inputs. Use a subtle background fill of `surface-variant` (#e1e3dc) with a bottom-only 2px focus line in `primary`.
- **States:** Error states use `error` (#ba1a1a) but keep the error text in `label-sm` (Inter) for a clean, non-alarming notification.

### Specialized Tracking Modules
- **The "Pulse" Chart:** For nutrition and training, use organic, rounded line strokes rather than jagged points.
- **The "Monolith" Progress Bar:** A thick, `lg` (1rem) rounded bar using `primary-fixed-dim` as the track and `primary` as the progress.

---

## 6. Do’s and Don'ts

### Do:
- **Do** use asymmetrical margins (e.g., more padding on the left than the right) for "Display" screens to mimic editorial layouts.
- **Do** use "Surface Tint" (#556340) for very subtle background overlays on images.
- **Do** prioritize white space over data density. If a screen feels "busy," remove a container and use space instead.

### Don’t:
- **Don’t** use pure black (#000000) for text. Always use `on-surface` (#191c18) to maintain the "warm/sober" aesthetic.
- **Don’t** use standard 4px "Material Design" corners. Stick to the `md` (0.75rem) or `lg` (1rem) tokens to keep the "soft and inviting" promise.
- **Don’t** use high-vibrancy "Neon" colors. All module colors must feel "tossed in dust"—muted, earthy, and sophisticated.