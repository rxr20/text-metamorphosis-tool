# Contributing a tool to TMT

TMT tools are small, declarative data files. No build step, no code. If you can write a good instruction for a language model, you can add a tool.

## Steps

1. **Fork** the repository.
2. **Copy** `tools/community/example-tool.js` to `tools/community/your-tool-id.js`.
3. **Edit** the definition: id, name, category, icon, your name, description, prompt, and a before/after example. See [docs/TOOL_SCHEMA.md](docs/TOOL_SCHEMA.md).
4. **Register** it by adding `"tools/community/your-tool-id.js"` to `tools/manifest.js`.
5. **Test** it: open `index.html` directly (double-click, `file://`) in Chrome or Edge, load a model, and try your tool on a few texts. Check the browser console for `[TMT] Skipped tool` warnings.
6. **Open a pull request** with a short explanation and an example input and output.

Pull requests are reviewed before merging. Publication is not automatic.

## Rules

- Definitions are **data only**: no functions, no HTML, no remote URLs, no scripts.
- A tool must not send text anywhere. Everything runs on the user's device.
- Write prompts that tell the model what to do to **one sentence** and to keep the meaning unless the tool says otherwise.
- Use `{{fieldId}}` placeholders for parameters and declare each one in `fields`.
- Keep `license: "MIT"` unless the maintainers agree otherwise.
- One tool per file. The file name should match the tool id.

## Tips for good prompts

- Be specific and short. Small models follow short instructions best.
- Say what to keep ("Keep the meaning") as well as what to change.
- Try the tool on sentences that need no change. It should leave them alone.

Thanks for helping people transform text.
