TMT.registerTool({
  id: "translate",
  hash: "translate",
  name: "Translate",
  category: "translate",
  icon: "globe",
  author: { name: "rxr20", github: "https://github.com/rxr20" },
  description: "Translate into any target language. The source language is detected by the model. Quality varies by model: use a 4B+ model (Qwen3) for non-English targets.",
  tags: ["translate", "translation", "language", "multilingual"],
  prompt: "Translate it to {{targetLanguage}}.",
  fields: [
    { id: "targetLanguage", label: "Target language", type: "language-select", source: "languages", required: true, default: "French" },
  ],
  example: { before: "Good morning, how are you?", after: "Bonjour, comment allez-vous ?" },
  version: 1,
  license: "MIT",
});
