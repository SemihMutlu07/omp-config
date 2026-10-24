---
name: steve
description: |
  Subtraction lens for any artifact: features, UI, APIs, docs, plans, and
  personal priorities. Applies the Jobs tests (attention budget, 3-second
  story, manual test, delete test, reference test, failure states, prototype
  before debate) and returns SHIP / FIX / REDESIGN / KILL / DEFER with the test
  that decided it. Does not replace safety, accessibility, legal, research
  breadth, or metric-driven work. Triggers: "bu gerekli mi?", "ne keselim?",
  "sadeleştir", "bunu ship edelim mi?", "bu iyi mi?", "ne bırakalım?".
disable-model-invocation: true
license: MIT
---

# Steve — the subtraction lens

> A lens, not a persona. Copy the tests, not the temperament.

**Premise.** Attention is the scarce resource. Every artifact — a screen, an
API, a README, a pull request, a meeting, a plan — spends someone's seconds
and choices. Design is the act of deciding what earns that spend.

The lens exists to make one class of decision better: *what should not exist,
and what should exist more clearly.* It is a critic, not an oracle.

## Apply it in 60 seconds

1. Name the artifact and the person who pays attention to it.
2. Name the one thing it is for, in one sentence.
3. Run the cheapest test that can fail: delete, manual, 3-second, reference,
   or failure-state.
4. If the test is inconclusive, build the cheapest prototype that settles it.
5. Return a verdict and the reversal cost. The human decides.

## Two rules before the lens

1. **The human decides.** Produce candidates and a recommended verdict. Never
   present taste as a fact, and never overrule evidence with conviction.
2. **Hold the standard, not the person.** Be impatient with the artifact, never
   with the person. Disagree with the work, not the worker. The Jobs temperament
   is not the method; it is the part that does not transfer.

## Six moves

| Move | Claim | Test |
|---|---|---|
| **Attention is the budget** | Cost is measured in the receiver's seconds and choices, not in features or lines | What does this add to the other person's day? |
| **Simplicity is residue** | Simplicity is what remains after the complexity is understood, not the smallest possible surface | Can you explain why each remaining part exists? If yes, large can still be simple |
| **Taste is comparison** | Taste is trained discrimination, not preference | Name the best existing version in the world. What does it do that this does not? |
| **The whole widget** | Surface and substance must tell one story | Do the name, shape, error, docs, and behavior agree? |
| **Demo over debate** | An argument is cheap; a prototype is decisive | What is the cheapest artifact that settles this? |
| **Ship is the unit of truth** | A demo is not a product until a stranger can use it without you | Can someone else run, maintain, and use it without you in the room? |

Two more that follow from them:

- **Say no to good ideas.** Focus that only rejects bad ideas is hygiene, not
  focus. Ask: *what good thing are we dropping to do this?*
- **The details are the product.** Quality is proven on the failure path:
  error, empty, loading, offline, first run, long text, no permission.

### Simplicity is not minimalism

A blank page is minimal. It is not simple. Removing necessary complexity —
accessibility, recovery, safety, internationalization — produces a simpler
screenshot and a worse product. The test is not "fewer things." It is "every
remaining thing carries its weight, and the user never has to carry the
complexity we removed."

Jobs, 1998: *"Simple can be harder than complex: you have to work hard to get
your thinking clean to make it simple."* The work is the thinking, not the
deletion.

### Taste without a reference is opinion

"Good taste" is not a preference to assert. It is the ability to notice the
difference between good and almost-good, trained by exposure. Make it
falsifiable: name the best version that exists anywhere, list the gap, and say
which gap matters for this audience. If no reference exists, say so and fall
back to a prototype comparison.

### The shadow

Jobs was often wrong, and his method had a human cost. He delayed conventional
medical treatment for months. He publicly humiliated people. The A-player claim
— that A players hire A players and B players hire C players — is a useful
warning about standards and a poor excuse for contempt. Use the lens to raise
the artifact, not to justify rudeness, binary thinking, or ignoring data.

## The tests

**A. The 3-second story.** What is this, what can I do here, is it for me?
Apply to a screen, a README's first screen, a PR description, a CLI's first
run, an email's subject line.

**B. The manual test.** A stranger completes the primary task with no
onboarding, tooltip, placeholder, or help text. If they hesitate, the artifact
explains itself badly. This does not forbid documentation; it forbids
documentation as a substitute for design.

**C. The delete test.** Remove the feature, field, paragraph, flag, or meeting.
Does anything break? If nothing breaks, it should not exist. If something
breaks, you found the load-bearing part.

**D. The good-idea test.** Name the best thing you are saying no to. If there
is nothing good in the no, you are not focusing; you are cleaning.

**E. The reference test.** Name the best existing example in the world and the
gap. Do not compare against the nearest competitor if the nearest competitor is
mediocre.

**F. The failure test.** Exercise error, empty, loading, slow, offline,
permission-denied, first-run, and long-content states. If the failure path is
bad, the product is bad, regardless of the happy path.

**G. The stranger test.** Can another person ship, maintain, and use this
without you? If not, it is a demo with a deadline.

**H. The reversal test.** How cheap is it to undo? Prefer reversible decisions.
The lens should produce decisions that can be tested, not dogma that must be
defended.

## Where the lens earns its keep

| Situation | Use it? | What it actually decides |
|---|---|---|
| Feature scope, MVP cut, roadmap | Yes | Necessity and focus |
| UI/UX, interaction, empty and error states | Yes | Attention and coherence |
| API, CLI, library surface, defaults, naming | Yes | Surface area and first use |
| README, PR, email, deck, docs | Yes | The 3-second story and subtraction |
| Personal priorities, side projects | Yes | Which good option to drop |
| Reviewing an artifact before ship | Yes | Quality gate |
| Choosing among 2–3 prototypes | Yes | Which shape wins |

## Where it does not

| Situation | Why not | What decides instead |
|---|---|---|
| Safety-critical correctness | Standards and evidence, not taste | Tests, review, domain rules |
| Accessibility, legal, compliance breadth | Requirements are non-negotiable | The requirement; the lens may only simplify presentation |
| Exploratory research | Breadth is the point; early killing destroys signal | Coverage and falsification |
| Consensus, ethical, stakeholder decisions | The lens is one voice, not the room | The people affected |
| Quantitative optimization | The metric decides | The metric and its guardrails |
| Mechanical change with an established pattern | Cost exceeds benefit | The existing convention |
| A literal, minimal edit the user requested | Respect the ask | The request |

Partial use is normal. On a safety-critical screen, the lens may decide how to
present a required control; it may not decide whether the control exists.

## Prototype menu

The lens prefers a cheap artifact over a long argument. One question per
prototype; throw it away; record the verdict.

| Prototype | Question it answers | Cost | Typical use |
|---|---|---|---|
| **Delete prototype** | Is this needed at all? | Minutes | Any feature or field |
| **3-second prototype** | Is the story obvious? | Minutes | Any surface or document |
| **One-path prototype** | Does the core motion work? | Hours | New flow |
| **Two-shape prototype** | Which design is right? | Hours–days | Novel interaction |
| **Skeleton prototype** | Does the hierarchy hold at real density? | Hours | Content-heavy UI |
| **Failure prototype** | Do the bad states hold up? | Hours | Anything networked or async |
| **One-day prototype** | What would we launch tomorrow? | One day | Scope decisions |
| **Usage-first prototype** | Is the interface pleasant to call? | Minutes | API, CLI, library |
| **Headline prototype** | Is the point clear? | Minutes | Writing, docs, decks |
| **Paper prototype** | Is the decision framed correctly? | Minutes | Meetings, plans |

Rules: the prototype must answer one named question; it must be disposable;
it must be cheap enough that defending it costs more than rebuilding it. A
prototype that survives as production code was not a prototype.

## Worked examples

**A feature request.** "Add a CSV export." Delete test: who asked, and what do
they do next? If the answer is "they open it in a spreadsheet once a month,"
the real need may be a scheduled report, not a button. Verdict: DEFER the
button, prototype the report.

**An API flag.** "Add `--legacy-format`." Usage-first prototype: write the
call site and the help text. If the help text needs a paragraph, the flag is
the wrong fix; fix the default or the migration path.

**A README.** 3-second test: the first screen must say what this is, who it is
for, and what to type. Headline prototype: write the first sentence before the
body. If the sentence is vague, the product is vague.

**A recurring meeting.** Delete test: cancel it for two weeks. What breaks? If
nothing, it was a status broadcast; replace it with a written update. If
something breaks, that something is the real agenda.

**A side project.** Good-idea test: name the best thing you would drop to keep
it. If there is no good thing, the project is not competing with anything
important; that is a reason to continue, not a reason to feel guilty.

## Output contract

When the lens is applied, return:

```
Artifact: [what is being judged]
One sentence: [what it is for]
Reference: [best-in-world example and the gap]
Deciding test: [A–H and the observed result]
Prototype: [the cheapest one that would settle an open question, or "none"]
Remove: [the specific thing that should not exist]
Verdict: SHIP / FIX / REDESIGN / KILL / DEFER
Reversal cost: [cheap / moderate / expensive]
Confidence: [high / medium / low, with the missing evidence]
```

## Review prompt

```
Evaluate this artifact through the Steve lens.

1. ATTENTION: What does it cost the receiver in seconds and choices?
2. ONE THING: What is it for, in one sentence?
3. DELETE: What can be removed without breaking the purpose?
4. REFERENCE: What is the best existing version, and what is the gap?
5. FAILURE: Are the error, empty, loading, and first-run states as good as
   the happy path?
6. PROTOTYPE: What cheap artifact would settle the open question?
7. SHADOW: Where is this lens wrong for this case?

Output the contract above. The human makes the final call.
```

## Failure modes of this lens

- **Minimalism theater.** Fewer elements, no more clarity. The user still has
  to guess.
- **Taste as authority.** An unfalsifiable "I know it when I see it" that ends
  the discussion instead of opening a comparison.
- **Persona cosplay.** Rudeness, binary verdicts, and contempt presented as
  high standards.
- **Prototype graveyard.** Prototypes that answer no question and decide
  nothing.
- **Premature kill.** Applying a shipping lens to research, exploration, or
  compliance work where breadth is the requirement.
- **Local simplicity, global complexity.** Removing a step from the user and
  moving it to support, ops, or the next screen.
- **Nostalgia.** Copying a 2007 Apple decision into 2026 constraints. The tests
  are timeless; the answers are not.

## Final rule

The lens is successful when it produces a decision someone can check, not when
it produces a verdict that sounds like Steve.
