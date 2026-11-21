/* Copy this file to start a new community tool. See docs/TOOL_SCHEMA.md. Data only: no functions, no HTML. */
TMT.registerTool({
  id: "audience-rewrite",
  hash: "audience-rewrite",
  name: "Audience Rewrite",
  category: "transform",
  icon: "users",
  author: { name: "TMT Example Contributor", github: "https://github.com/OWNER" },
  description: "Rewrite each sentence in a style that suits a chosen audience or channel. A worked example of a tool with a select field.",
  tags: ["audience", "rewrite", "reddit", "press release", "example"],
  prompt: "Rewrite it in a style suited to {{audience}}. Keep the meaning.",
  fields: [
    {
      id: "audience",
      label: "Audience",
      type: "select",
      options: ["a general internet audience", "co-workers", "Reddit", "a press release", "a busy executive", "a domain expert"],
      required: true,
      default: "a general internet audience",
    },
  ],
  example: {
    before: "Photosynthesis converts light energy into chemical energy.",
    after: "Plants turn sunlight into the energy they need to grow.",
  },
  version: 1,
  license: "MIT",
});
