# Content schema for SC-500 study data

Each section file is `data/content/<sectionId>.json` (for example `data/content/d1s1.json`) and must be valid JSON with this shape:

```json
{
  "sectionId": "d1s1",
  "objectives": [
    {
      "objectiveId": "d1s1o1",
      "summary": "2–4 sentence plain-English overview of what this objective covers and why it matters.",
      "keyFacts": [
        { "fact": "One precise, exam-relevant fact in your own words.", "source": "https://learn.microsoft.com/..." }
      ],
      "portalPath": "Optional: where the setting lives, e.g. Microsoft Entra admin center > ID Governance > Privileged Identity Management > Microsoft Entra roles > Roles > Role settings",
      "lab": {
        "title": "Short hands-on exercise title",
        "steps": ["Step 1 ...", "Step 2 ..."],
        "verify": "How to confirm it worked",
        "source": "https://learn.microsoft.com/..."
      },
      "learnModules": [
        { "title": "Microsoft Learn training module or doc title", "url": "https://learn.microsoft.com/training/modules/..." }
      ],
      "flashcards": [
        { "front": "Question or term", "back": "Answer", "source": "https://learn.microsoft.com/..." }
      ],
      "questions": [
        {
          "id": "d1s1o1-q1",
          "type": "single",
          "difficulty": 2,
          "scenario": "Optional company/environment context (original, fictional).",
          "question": "What should you configure?",
          "options": ["A ...", "B ...", "C ...", "D ..."],
          "answer": [1],
          "explanation": "Why the right answer is right AND why each distractor is wrong.",
          "sources": [{ "title": "Doc title", "url": "https://learn.microsoft.com/..." }]
        }
      ]
    }
  ]
}
```

## Question types

- `single`: one correct option. `answer` is an array with one zero-based index.
- `multi`: two or more correct options. `answer` lists all correct indices. The question text must say how many to pick (e.g. "Each correct answer presents part of the solution. Choose two.").
- `yesno`: a list of statements to judge. Use `statements: [{ "text": "...", "answer": true }]` instead of `options`/`answer`.
- `hotspot`: drop-down selections. Use `dropdowns: [{ "label": "Approvers", "options": ["..."], "answer": 2 }]` instead of `options`/`answer`.
- `order`: put steps in sequence. Use `items: ["step A", "step B", ...]` listed in the CORRECT order; the app shuffles them.

`difficulty`: 1 = recall, 2 = apply, 3 = multi-step scenario.

## Hard rules

1. Every fact, answer and explanation must be verifiable on a learn.microsoft.com page that you actually opened with the Microsoft Learn tools in this session. Put that URL in `source` / `sources`. Never cite a URL you did not open or search-hit.
2. Write ORIGINAL scenarios and questions in your own words. Do NOT copy, paraphrase closely, or reconstruct any question from exam dump sites (ExamTopics, Scribd, etc.). Using brain-dump material violates the Microsoft Certification Exam Candidate Agreement.
3. Paraphrase Microsoft Learn text; never paste sentences longer than ~15 words.
4. If Learn documents a feature as preview, say "(preview)" in the fact or explanation.
5. If you cannot verify something, leave it out rather than guess.
6. Use fictional names (Contoso, Fabrikam, Admin1, VM1...).
