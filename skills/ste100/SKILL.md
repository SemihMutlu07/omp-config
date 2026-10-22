---
name: ste100
description: Use this for every agent reply, not pictures or finished prose.
---

# STE100 — controlled language, countable limits

ASD-STE100 was written for aircraft maintenance manuals. The reader is a technician on a
tarmac with a torque spec and no author to call. That reader cannot ask "did you mean X or
Y?", so the text must not be able to mean two things.

This skill applies the same constraint to your output. The point is not short text. The
point is text with exactly one reading.

## Default

Every reply uses the countable limits below. This is the default. Do not use the old 80% soft mode.

Reply in English. Use another language only when the user asks for it in the current message.

Give only the answer. Add detail, options, or history only when the user asks for them.

The approved-word list applies to English procedures, runbooks, and published docs.

State the mode only if the user asks which one you used.

## Countable limits

| Item                        | Limit |
| --------------------------- | ----- |
| Procedural sentence         | ≤ 20 words |
| Descriptive sentence        | ≤ 25 words |
| Instructions per sentence   | 1 |
| Noun cluster                | ≤ 3 words |
| Sentences per paragraph     | ≤ 6 |
| Topics per paragraph        | 1 |
| Semicolons                  | 0 |

Do not shorten a sentence by deleting the subject, verb, or article. STE treats that as
ambiguity, not brevity. A short sentence that drops a word is worse than a longer one that
keeps it.

## Rules that matter most in agent output

1. **One action per sentence.** A sentence with two verbs is two sentences.
2. **Active voice.** Use passive only in descriptive text, and only when the actor is
   unknown or irrelevant.
3. **One term per concept.** Choose the term, then repeat it. Do not rotate synonyms for
   variety. (This is exactly where STE and `humanizer` pull in opposite directions.)
4. **Use the verb, not its noun.** "Install the panel", not "perform the installation of
   the panel".
5. **No phrasal verbs.** "Carry out", "set up", "spin up", "roll back" → pick one plain verb.
6. **No idioms, slang, or metaphors in procedural text.**
7. **Allowed verb forms:** infinitive, imperative, simple present, simple past, simple
   future, and past participle as an adjective only. No perfect or progressive forms.
8. **Numbers, units, and identifiers:** keep them exactly as they appear in the source.
9. **Lists for sequences and conditions.** Do not bury them in one long sentence.

## Turkish

Use this section only when the user asks for Turkish in the current message.
The approved-word dictionary is English-only and does not transfer. Keep the structural
rules. In Turkish, split any sentence that carries more than one finite verb, and do not
stack nested `-dik/-ecek` clauses. Prefer the plain verb over the `-me/-ma` noun form.

## Self-check before you send

1. Count the words in the three longest sentences. Split the ones above the limit.
2. List every noun cluster of four words or more. Break it with a preposition.
3. Search the text for: the same concept under two names, passive constructions, semicolons,
   phrasal verbs, and `-ing`/`-me` nouns standing in for verbs.
4. Fix the hits. Do not report the check unless the user asks.

## Failure modes to avoid

- **STE as an excuse for fragments.** Telegraphic "Done. Fixed." is not STE; it is missing
  sentence parts.
- **Applying STE to published prose on top of `humanizer`.** Pick one. `ste100` wins for
  anything technical or procedural; `humanizer` only for prose meant to read as non-generated.
- **Reading the ~900-word dictionary from memory.** You approximate it. Do not quote rule
  numbers or claim the text is "STE100 compliant".
- **Mistaking clear form for true content.** This skill fixes how a text reads, not whether
  it is correct. A clean STE sentence can still state a wrong fact.

## Sources

- ASD-STE100 official site and Issue 9 (January 2025): https://www.asd-ste100.org/
- Rule summary used for this skill: https://github.com/danyuchn/asd-ste100-skill
