# SC-500 Field Manual — rules for Claude

This repo is an SC-500 study site. Content lives in `data/content/<section>.json`, one file per study-guide section. The official objective list is `data/objectives.json`.

## Hard rules for any content you add or change

1. **Microsoft Learn only.** Every fact, answer and explanation must be verified on a learn.microsoft.com page you actually opened in this session with the Microsoft Learn MCP tools (`microsoft_docs_search`, `microsoft_docs_fetch`). Cite that URL in `source` / `sources`.
2. **No exam dumps.** Never copy, closely paraphrase or reconstruct questions from ExamTopics, Scribd, or any "actual exam questions" site. Write original scenarios with fictional names (Contoso, Fabrikam, Admin1, VM1).
3. **Paraphrase Learn.** No quoted passages longer than ~15 words.
4. **Flag preview features** with "(preview)". If you can't verify something, leave it out.
5. **One correct answer.** Make sure no distractor is also defensibly correct. Explanations say why each wrong option is wrong.
6. Follow the format in `docs/CONTENT_SCHEMA.md` exactly. Question IDs must stay unique (`<objectiveId>-q<n>`).

## After every content change

```bash
node docs/validate.mjs     # must report errors=0
node build.mjs             # regenerates data/bank.json and index.html
```

Don't edit `data/bank.json` or `index.html` by hand; they're generated.

## Typical requests

- "Add 3 more questions to d2s3o8 (Azure Firewall)"
- "Re-check d4s2 against Learn; fix anything outdated"
- "Compare data/objectives.json with the current SC-500 study guide and update it"
