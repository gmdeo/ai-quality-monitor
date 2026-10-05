// Discrimination test: feed each scorer known-good and known-bad answers and
// confirm it separates them. A monitor that passes everything is worthless.
//
// Run: npx tsx app/lib/discrimination-test.ts

import { TEST_SUITE } from "./quality";

const cases: Record<string, { good: string; bad: string; note: string }[]> = {
  code_generation: [
    {
      note: "correct regex in Python raw string",
      good: "Here you go:\n```python\nimport re\nPATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'\n```",
      bad: "Just use a simple check like '@' in email and make sure there is a dot somewhere after it.",
    },
    {
      note: "plausible-looking but wrong regex (no TLD requirement)",
      good: "```js\nconst re = /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/\n```",
      bad: "```js\nconst re = /^.+@.+$/\n```",
    },
  ],
  logical_reasoning: [
    {
      note: "correct 'no' with reasoning",
      good: "No. This is the fallacy of undistributed middle: the flowers that fade quickly need not include any roses. We cannot conclude that some roses fade quickly.",
      bad: "Yes, we can conclude that some roses fade quickly. Since some flowers fade quickly and all roses are flowers, therefore some roses fade quickly.",
    },
    {
      note: "correct answer phrased as restatement-then-negation",
      good: "To determine whether we can conclude that some roses fade quickly, we must check the middle term. It is not distributed, so the answer is no.",
      bad: "Therefore, some roses fade quickly. The answer is yes.",
    },
  ],
  factual_accuracy: [
    {
      note: "Canberra with the confusion explained",
      good: "The capital of Australia is Canberra, not Sydney. Many people confuse it with Sydney or Melbourne because they are larger.",
      bad: "The capital of Australia is Sydney. It is the largest city in the country.",
    },
  ],
  instruction_following: [
    {
      note: "three items, no preamble, one line",
      good: "1. Better cardiovascular health 2. Improved mood 3. Stronger muscles",
      bad: "Here are three benefits of exercise:\n1. Better cardiovascular health\n2. Improved mood\n\nIn conclusion, exercise is good for you.",
    },
    {
      note: "undershoot — only two items",
      good: "1. Better sleep 2. More energy 3. Lower stress",
      bad: "1. Better sleep 2. More energy",
    },
  ],
};

let failures = 0;

for (const [categoryId, tests] of Object.entries(cases)) {
  const category = TEST_SUITE.find((c) => c.id === categoryId)!;
  console.log(`\n${"─".repeat(74)}\n${category.name}  (threshold ${category.threshold}%)\n`);

  for (const t of tests) {
    const g = category.score(t.good);
    const b = category.score(t.bad);
    const gPass = g.score >= category.threshold;
    const bPass = b.score >= category.threshold;

    let verdict: string;
    if (gPass && !bPass) {
      verdict = "OK — discriminates";
    } else if (!gPass) {
      verdict = "BUG — rejected a good answer";
      failures++;
    } else {
      verdict = "WEAK — accepted a bad answer";
      failures++;
    }

    console.log(`  ${t.note}`);
    console.log(`    good: ${String(g.score).padStart(3)}%  ${gPass ? "pass" : "FAIL"}`);
    console.log(`    bad:  ${String(b.score).padStart(3)}%  ${bPass ? "pass" : "FAIL"}`);
    console.log(`    ${verdict}\n`);
  }
}

console.log("─".repeat(74));
console.log(failures === 0 ? "ALL SCORERS DISCRIMINATE" : `${failures} PROBLEM(S) FOUND`);
process.exit(failures === 0 ? 0 : 1);
