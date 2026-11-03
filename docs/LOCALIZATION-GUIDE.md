# Localization guide

The active product supports English, Simplified Chinese, Traditional Chinese, Spanish, Brazilian Portuguese, French, German, Japanese, Korean, Arabic, and Hindi. User-requested localized UI values override the earlier English-only interface-copy convention; source identifiers, comments, filenames, protocol values, model instructions, exports, and technical logs remain English.

`lib/i18n/english.json` is the canonical message catalog. Every locale file contains the same stable message IDs and preserves the same numbered interpolation parameters. `LocalizedContent` translates React display nodes and accessibility attributes before rendering. It does not modify DOM nodes after rendering, event handlers, input values, IDs, request bodies, market symbols, account state, or the trading ledger. Source notes marked `data-i18n="source"` and raw code/export formats retain their original wording.

The locale preference is stored in the browser and in a same-site preference cookie. The server reads that cookie or the request language for initial HTML, metadata, and text direction. Arabic uses right-to-left text, while market-chart time direction and financial notation remain unchanged. Charts receive their own locale and translated price-line labels.

Audio volume has a distinct message from trading volume. Shared English wording with different meanings must receive separate source messages. Run the localization tests after adding or changing copy. A new selectable locale must contain the complete catalog, not an English fallback stub.

Traditional Chinese starts from the reviewed Simplified Chinese catalog with OpenCC's Taiwan phrase conversion and selected terminology adjustments. OpenCC is an authoring aid; it is not a runtime dependency and no translation model or paid translation API is called by the website.

The old manual Play flow is no longer a public entry. Legacy training, market-lab, and progress URLs open a read-only practice archive; saved data and English-schema exports remain available. No new training round or coach request is triggered by opening the agent or archive.
