# TMT | Text Metamorphosis Tool

**Your words. Your device. Your rules.**

TMT is a browser-based text transformation workstation. Pick a tool, enter text, review sentence-level suggestions, and accept changes one by one or all at once. The model runs on your device through [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU, so **your words stay on your PC**.

<!-- TBD docs/screenshot-hero.png -->
## Private by design

- Text is processed by a model running in your browser, on your GPU.
- Your text, the prompts built from it, and the generated suggestions are not sent to a cloud AI service.
- There is no backend, account, analytics or telemetry.
- Being precise about the network: the **WebLLM runtime** is fetched from a CDN (`esm.run`) and **model files** are downloaded when you click *Load model*. TMT is not an offline app and does not claim to be.
- If WebGPU or model loading is unavailable, TMT says so. It never falls back to remote inference.

## How it works

1. **Choose a tool** in the left sidebar (search by name, description, tag, category or author).
2. **Load a model** from the header, then type or paste text.
3. **Review suggestions.** Each sentence is processed separately. Changed sentences are highlighted in both panels, and hovering one highlights its match in the other.
4. **Accept** a suggestion by clicking it, or use **Approve all**. Copy the source, or copy the result with everything applied.

<!-- TBD docs/workflow.gif -->

### Key capabilities

- Sentence-by-sentence processing with caching (by model, instruction and sentence), cancellation and debounce.
- Tools for improving, translating and transforming text, plus a **Custom** instruction.
- A **Translate** tool with a searchable, extensible target-language list.
- A text-metamorphosis reveal when a suggestion arrives (respects `prefers-reduced-motion`).
- Live metrics computed from your real text. Token count is an estimate (about 4 characters per token).
- Responsive layout for desktop, tablet and mobile.

## Requirements

- A recent **Chrome or Edge** with WebGPU enabled.
- An internet connection the first time, to download the WebLLM runtime and the model you pick.
- Enough GPU memory for the chosen model. Smaller models are faster and lower quality.

## Run it

TBD

## Contribute a tool

> **Have a text transformation idea? Contribute a tool.**
> Add a small definition, include an example, and open a pull request. If it helps people transform text, it belongs in TMT.

A tool is one small data file. Copy `tools/community/example-tool.js`, edit it, add its path to `tools/manifest.js`, and it appears in the sidebar automatically. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [tool schema](docs/TOOL_SCHEMA.md). Contributions are reviewed before merging.

If you find TMT useful, a star on GitHub helps other people discover it.

## Architecture

```text
index.html              entry point (no build, classic scripts)
resources/
  registry.js           tool validation + loader (data only, never runs contributor code)
  script.js             UI, sentence engine, WebLLM flow, metamorphosis effect
  style.css             TMT visual system
tools/
  manifest.js           list of tool files
  languages.js          target languages for Translate
  built-in/*.js         core tools
  community/*.js        contributed tools
docs/TOOL_SCHEMA.md     exact tool format
```

- Tool files call `TMT.registerTool({...})`. They are loaded as classic `<script>` elements, so everything works from `file://` (no `fetch()` of local JSON, no ES modules for local files).
- The registry validates each definition, skips bad ones with a console warning, and never lets them break the app.
- The sidebar, search, parameter fields and the instruction are generated from the registry.
- WebLLM is loaded with a dynamic `import()` from a CDN. It is not bundled, and no model weights are hosted here.
- Bootstrap's reset and jQuery are bundled in `resources/`. The visual identity is custom.

## Known limitations

- Quality depends on the model. Tiny models make mistakes, especially in less common languages.
- Sentences are processed independently, so context across sentences is not used.
- WebGPU is required. Other browsers are not supported.
- The first model load can be large and slow.

## Credits


Flag emoji are rendered with the bundled `resources/TwemojiCountryFlags.woff2` (Twemoji flag graphics, CC-BY 4.0, via the MIT-licensed `country-flag-emoji-polyfill` package), because Windows browsers do not draw flag emoji natively.
