# TMT tool schema

A tool is one classic JavaScript file that calls `TMT.registerTool({...})` with a plain data object. It is listed in `tools/manifest.js`. The registry validates it; invalid tools are skipped with a console warning and never break the app.

## Fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Unique, lowercase kebab-case (`my-tool`). Max 60 characters. |
| `hash` | no | URL hash for this tool (`index.html#translate`), lowercase kebab-case and unique. Defaults to `id`. Makes the tool bookmarkable and works with the browser Back/Forward buttons. |
| `name` | yes | Display name. Max 40 characters. |
| `category` | yes | `improve`, `translate` or `transform`. (`custom` is reserved for the built-in custom instruction.) |
| `icon` | yes | An approved icon key (below) or a single emoji. |
| `author.name` | yes | Contributor display name. |
| `author.github` | no | Profile URL starting with `https://github.com/`. |
| `description` | yes | What the tool does. Max 300 characters. |
| `prompt` | yes | Instruction sent to the model for each sentence. Max 1000 characters. May contain `{{fieldId}}` placeholders. |
| `example.before` / `example.after` | yes | Sample input and expected output. |
| `tags` | no | Up to 10 short search keywords. |
| `fields` | no | Up to 4 parameter inputs (below). |
| `version` | no | Whole-number version of your definition, e.g. `1`. |
| `license` | no | e.g. `"MIT"`. |

Whether a tool is shown as `BUILT-IN` or `COMMUNITY` is decided by its folder (`tools/built-in/` or `tools/community/`), not by the file.

## Icons

`spell-check`, `scissors`, `expand`, `simplify`, `sparkle`, `globe`, `briefcase`, `chat`, `smile`, `graduation`, `wand`, `pen`, `bolt`, `users`, `terminal`, or a single emoji such as `"🎭"`.

## Fields

```js
fields: [
  { id: "audience", label: "Audience", type: "select", options: ["a child", "an expert"], required: true, default: "a child" }
]
```

| Property | Description |
| --- | --- |
| `id` | Letters and numbers, starting with a letter. Used as `{{id}}` in the prompt. |
| `label` | Label shown above the input. |
| `type` | `language-select` (dropdown with flags and search, from `tools/languages.js`; custom entries allowed), `select` (needs `options`), or `text`. |
| `source` | For `language-select` only: `"languages"`. |
| `options` | For `select`: up to 50 strings. |
| `required` | Defaults to `true`. Processing waits until required fields have a value. |
| `default` | Initial value. |

Every `{{placeholder}}` in `prompt` must match a declared field id.

## Copyable example

```js
TMT.registerTool({
  id: "audience-rewrite",
  hash: "audience-rewrite",
  name: "Audience Rewrite",
  category: "transform",
  icon: "users",
  author: { name: "Your Name", github: "https://github.com/your-handle" },
  description: "Rewrite each sentence in a style that suits a chosen audience or channel.",
  tags: ["audience", "rewrite"],
  prompt: "Rewrite it in a style suited to {{audience}}. Keep the meaning.",
  fields: [
    { id: "audience", label: "Audience", type: "select", options: ["a general internet audience", "co-workers", "Reddit", "a press release"], required: true, default: "a general internet audience" },
  ],
  example: {
    before: "Photosynthesis converts light energy into chemical energy.",
    after: "Plants turn sunlight into the energy they need to grow.",
  },
  version: 1,
  license: "MIT",
});
```

## What is rejected

Missing required fields, invalid category, malformed or duplicate ids, unknown icon, unsupported field types, placeholders without a matching field, values over the length limits, and any definition containing functions or non-data values. Skipped tools are listed in the browser console as `[TMT] Skipped tool ...`.
