---
status: accepted
date: 2026-11-08
---

# Internationalization

## Context and problem statement

Curved needs to decide how much internationalization to build, and when.

Two needs are often mixed up:

- **Thai content.** Users type Thai into issues and comments. About 15% of the spike's text was Thai. The app must display, wrap and format it well whatever language the interface uses.
- **Interface translation.** Menus, buttons, error messages and emails in a language other than English.

Constraints:

- The first user is the maintainer, as a personal task manager, and an English interface is fine for them. Wider open-source use comes later.
- Interface translation may come after the MVP.
- The maintainer is the only translator and will not hire one, so Thai is the only other language we expect.
- The maintainer prefers low long-term maintenance.
- Thai and English are both written left to right. Right-to-left languages are out of scope.

## Considered options

- No internationalization. English only, with no preparation.
- English only for the MVP, written so that adding Thai later is cheap.
- An i18n library from the start, with every string wrapped, and Thai added when ready.
- Thai and English complete in the MVP, with CI requiring translations on every pull request.

## Decision outcome

Chosen option: English only for the MVP, written so that adding Thai later is cheap. Translation would not help anyone during the MVP, so an i18n library would cost upkeep for no benefit. Retrofitting one language translated by one person is small if the code follows the rules below. Thai content support is not optional and is part of the MVP.

### Rules for the MVP

Strings:

- The interface is English only, with no i18n library.
- Write each sentence whole in JSX. Do not build sentences from pieces, such as `"Assigned to " + name`. Whole sentences can be wrapped later file by file.
- Every error has a `code`. The public API already returns `{ "error": { "code": "...", "message": "..." } }`. Zero mutators throw `app` errors with a code and an English message. Better Auth emails are in English.

Dates and numbers:

- Store instants as `timestamptz`, as the conventions already require.
- Store dates without a time, such as due dates, as Postgres `date`. Zero 1.11.3 exposes `date` as milliseconds at midnight UTC, so handle these values in UTC only. Never read them with local-time methods such as `getDate()`, or users west of UTC see the previous day.
- Format dates, numbers and relative times only through one helper module, `apps/web/src/lib/format.ts`, built on `Intl`. It caches formatter instances, because creating them for every row is slow with large lists. It keeps the locale, `en`, in one constant.
- Prefer formats with month names, such as "Nov 8" and "Nov 8, 2026". Avoid all-numeric dates such as `11/8/2026`, which readers in Thailand may read as 11 August.
- Times use the default of `en`, which is the 12-hour clock. Change it in the helper if needed.
- Weeks start on Monday, as in ISO 8601, for date pickers and cycles. The default of US English is Sunday, so set it in the helper. A personal preference can follow.
- Display times in the browser's time zone. Add a `user.time_zone` column with an IANA name, such as `Asia/Bangkok`, when a server feature first needs local time, such as reminder emails or daily digests.
- Use no date library. Write the few date calculations we need, such as today, comparing due dates and adding days, as small helpers. Move to `Temporal` once Safari supports it. Chrome 144 and Firefox 139 already do, but the polyfill is about 160KB.
- Store years in the Gregorian calendar.

Thai typography:

- Add Anuphan Variable (`@fontsource-variable/anuphan`, OFL) after Geist:

  ```css
  --font-sans:
    "Geist Variable", "Anuphan Variable", "Sukhumvit Set", "Thonburi", "Leelawadee UI", sans-serif;
  ```

  Fontsource sets `unicode-range`, so the browser downloads the Thai file, about 19KB, only when a page shows Thai text.

- Anuphan's weights stop at 700 while Geist goes to 900. Text that may contain Thai uses `font-bold` at most.
- Thai stacks vowels and tone marks above and below the line. Multi-line text, such as descriptions and comments, uses a line height of at least 1.6. Single-line text, such as list rows and buttons, uses at least about 1.4. Tailwind's `text-sm` (20/14) meets this. Do not use `leading-none` or `leading-tight` on anything that can hold user text.
- Leave enough room around `truncate` and `overflow: hidden`, or tone marks are clipped. Component tests use a string with stacked marks, such as "ปู่ญี่ปุ่นฎีกาฤๅษี".
- Rely on the browser's Thai line breaking. Chrome, Safari and Firefox find Thai word boundaries with a dictionary. Never use `word-break: break-all` or `text-align: justify`. Use `overflow-wrap: anywhere` for long URLs.
- Split Thai text into words in JavaScript, for example to count words, highlight search matches or move the caret by word, only with `Intl.Segmenter`, never by spaces.
- If Thai looks smaller than Geist next to it, tune it with `size-adjust` during implementation.

Thai text handling:

- Keyboard shortcuts must work while a Thai keyboard layout is active. With it, pressing the `C` key gives `event.key` as `แ`. Match `event.key` first, and fall back to `event.code`, the physical key, when `event.key` is not ASCII. This also keeps shortcuts right for other Latin layouts, such as AZERTY.
- Thai vowels and tone marks are separate code points, so `.length` and `.slice()` can split a tone mark from its consonant. Count and cut characters for display, such as length limits and avatar initials, with `Intl.Segmenter` and `granularity: "grapheme"`. Avatar initials use the first grapheme that is not a leading vowel (เ แ โ ใ ไ).
- Slugs and keys, such as `workspace.slug` and team keys like `ENG`, are ASCII only. When a name has no Latin letters, the user types the slug, or the app generates one. Display names can be any language.
- Zero 1.11.3 sorts strings by their UTF-8 bytes, which is code point order, and has no collation option. Words that start with a leading vowel, such as "เกม", then sort after "ฮ" rather than under "ก", as a Thai dictionary would. Accept this for the MVP. Lists sorted only in the browser use `Intl.Collator`.

### When Thai is added

This is the agreed direction. Check it against the ecosystem at that time and record any change in a new decision record.

| Area           | Direction                                                                                                                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library        | Lingui. It has ICU plurals and selects, extraction to PO files and a small runtime, and `@lingui/core` also runs in the API. Lingui 6.12 worked in a test with Vite 8.3, `@vitejs/plugin-react` 6.2, React 19.3 and TypeScript 7, using `lingui({ macroTransform: true })`, so no Babel or SWC plugin is needed.                             |
| Messages       | English source text is the message, and Lingui generates the IDs. Use `context` when the same English text has different meanings. Catalogs live in `apps/web/src/locales/{en,th}.po`. The maintainer edits the PO files directly. Add a translation platform such as Weblate only if community translators appear.                          |
| Locale         | A nullable `user.locale` column. When it is null, follow the browser's languages, and fall back to `en` when none match. No workspace default. Cloud and self-hosted instances use the same rule.                                                                                                                                            |
| Calendar       | `Intl.DateTimeFormat("th-TH")` uses the Buddhist calendar by default, so Thai dates show Buddhist era years with no extra work. `th-TH-u-ca-gregory` gives Gregorian years. Date inputs must convert the year back. A calendar preference can follow.                                                                                        |
| Server strings | The web app translates from the error `code`. The public API's `message` stays English, because developers read it. The API renders emails with `@lingui/core` in the recipient's `user.locale`.                                                                                                                                             |
| Checks         | CI runs `lingui extract` and fails if the catalogs change, so they never fall behind the code. `lingui compile --strict` runs at release time, not on every pull request, and missing Thai text falls back to English. To catch unwrapped strings, check whether Oxlint's JavaScript plugins can run Lingui's `no-unlocalized-strings` rule. |

### Consequences

- Good, because the MVP carries no i18n library, build step or translation work.
- Good, because Thai content displays and wraps well from the start.
- Good, because error codes, `date` columns and one formatting helper keep the later work to wrapping strings, which is mechanical.
- Good, because the library choice waits until it is needed, when the ecosystem may have changed. Paraglide 3.0 was released only on 2026-11-03.
- Bad, because adding Thai later still means wrapping every interface string. For an MVP-sized interface this should take a day or two.
- Bad, because nothing enforces whole-sentence strings or the formatting helper during the MVP. Code review must catch them.
- Bad, because Thai titles in Zero-sorted lists follow code point order, not Thai dictionary order.
- Neutral, because Thai search needs word segmentation, which [0001](0001-tech-stack.md) and [0004](0004-zero-spike-results.md) already leave to a separate decision.

## More information

Libraries compared on 2026-11-08: Lingui 6.12, Paraglide JS 3.2, react-i18next 18 with i18next 27, and react-intl 12. Paraglide was the runner-up. It is small and fully typed, but needs hand-written keys, has no extraction, and reloads the page by default when the locale changes.

Follow-up work:

- Add Anuphan to `apps/web/src/index.css` and the line height rules when the first screens are built.
- Add `apps/web/src/lib/format.ts` with the first screen that shows a date.
- Map database errors in mutators to safe messages with codes, as [0004](0004-zero-spike-results.md) requires.
