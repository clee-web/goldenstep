# Golden Steps — Conversion & Visual-Flow Strategy

Prepared against the live site (`shared/content.ts`, `data/content.json`, and the
rendered build). Every figure quoted below is one already on the site; nothing is
invented. Where a number is needed but does not exist yet, it is marked
**NEEDS DATA** rather than filled in with a plausible guess.

---

## 1. Honest starting position

Three facts that shape everything else.

**There is no donation path.** No payment provider, no donation language, no
pricing, no recurring option anywhere in the codebase. The only conversion
surfaces are `Get involved` → an enquiry form, and `Partner with us` → the same
form. The site is an awareness-and-credibility build with lead capture bolted on.

**The site is architected for institutions, not donors.** The partners copy
leads with "donor, institutional partner, social enterprise, community
organization", and the credibility load is carried by the six programmes, the
ward list (Manyatta B, Nyalenda A, Kolwa Central, Kolwa East, Kajulu) and the
partner section. That is a strong institutional signal — and it is aimed past
the person most likely to give you £20 on a Tuesday.

**The headline number is an estimate, and the site says so.** 35,500 across the
six programme areas, from `beneficiaries` in `shared/content.ts`, footnoted
"estimated direct beneficiaries stated in the project overview". That footnote
is honest and should stay. It also means **35,500 is reach, not outcome** — the
number of people touched, not the number whose circumstances changed. See §5.

### Where the flow currently breaks

Against the required Problem → Person → Proof → Action:

| Beat | Current state | Verdict |
|---|---|---|
| **Problem** | Hero leads with "Every step toward empowerment matters" — aspirational, no stakes named | **Missing** |
| **Person** | No named individual anywhere. Gallery is an 11-slide carousel | **Missing** |
| **Proof** | 35,500, six programmes, partners, live field projects | **Strong** |
| **Action** | One path: an enquiry form asking name + email + organisation + topic + message | **Weak** |

The two halves are inverted. The site asks the reader to accept a large
aggregate claim before it has given them a single reason to care, and then asks
for a high-effort response. Reading it as a donor: I am asked to care about 35,500
unnameable people, and to prove I care by writing a paragraph.

---

## 2. The one structural insight

**You have a scarcity problem, not a copy problem.**

35,500 people across 5 wards and 6 programmes. That is the most valuable asset
on the site and it is currently used as a single decorative number. Large
aggregates do not motivate donation — they produce *category-level thinking*
("NGOs help people, this one helps some people"). The identifiable-victim effect
is the counter-measure: one named person, one face, one outcome.

The gallery's 11 photographs (7 original, 4 recently added) are the raw material
for this and they are currently sitting in a carousel, which is structurally
hostile to it. A carousel
auto-advances — it physically prevents the dwell time the effect depends on.
**The Person section must be a single static image and a single quote.**

---

## 3. Proposed section flow

Reordering is the highest-leverage change and it costs nothing.

| # | Section | Beat | Change |
|---|---|---|---|
| 1 | Hero | Problem + promise | Reframe headline; one dominant CTA |
| 2 | **The Problem** | Problem | **NEW** — name the scale, sourced |
| 3 | **Her Name Is…** | Person | **NEW** — one consented story |
| 4 | What we do | Context | Programmes, demoted from `#4` to `#4` but reframed as the *method* behind the person |
| 5 | Impact | Validation | 35,500, reframed reach vs outcome |
| 6 | Field | Validation | Real projects, real dates — one marked in-progress |
| 7 | **Give** | Action | **REBUILT** — three escalating tiers |
| 8 | Partner | Action | Existing, for institutional donors |
| 9 | Contact | Action | Existing enquiry form, demoted |

### Demote the Ticker

The scrolling six-noun marquee ("Gender & GBV • Health • Child Protection…")
occupies the single highest-attention position on the page — directly under the
hero, where the reader's focus peaks — and returns zero emotional value. It is
the definition of your Tier-3 "context layer" content in a Tier-1 position.
**Remove it, or move it below the fold.** It costs you a first-impression beat
to restate your own section headings.

---

## 4. Section-by-section blueprint

### 1. Hero — Problem + Promise

**Current:** "Every step toward **empowerment** matters." / CTAs: "Explore our
work", "Partner with us".

**Issue:** nothing is at stake. "Empowerment" is an outcome the reader has no
reason to want yet. And two CTAs of equal weight split attention — the framework
requires action colour be unambiguous, and two competing CTAs is the opposite.

**Draft copy** (place/stake needs a source — see below):
> **Eyebrow:** Kisumu East, Kisumu County
> **Headline:** *[N] women in Kisumu East have experienced gender-based violence.* Every step toward ending it starts with someone who shows up.
> **Sub:** Golden Steps works alongside women, youth and communities in five wards — GBV response and referral, health, child protection, economic empowerment and climate action.
> **Primary CTA:** See how you can help →
> **Secondary (text link, not a button):** Partner with us

**Focal element & visual weight:** the photograph, full-bleed, occupying the
majority of the viewport. Subject facing into the page toward the CTA — the
sightline cue you asked for, and free, because it only requires choosing the
right frame from the 11 you now have.

**Psychological trigger:** stakes + locus of control. The current copy is
altruistic ("matters"); the draft puts the reader's agency first.

**Directional cue:** sightline + a visible scroll affordance.

> **NEEDS DATA — the headline number.** Do not write this line until you have a
> citable figure. Kenya has credible national and county sources (KNBS
> demographic and labour surveys, the KNCHR annual report, DIGNITY's work on
> femicide in Kenya). Use a *sourced* number and cite it on the page. A
> fabricated or unsourced statistic in a hero is the single highest-risk thing
> on this list — institutional donors verify, and it costs more trust than the
> whole redesign earns.

---

### 2. The Problem — NEW

**Purpose:** make the cost of inaction concrete and local. Currently the site
jumps from aspiration straight to "we support vulnerable groups", which asserts
need without establishing it.

**Structure:** three short blocks, one per scale — national → county → the five
wards you actually work in. Narrowing geography is the device that makes a
statistic feel like a neighbour rather than a headline.

> **NEEDS DATA.** Every figure here requires a citation. This section is
> entirely dependent on sourced research and cannot be written responsibly until
> that research is in hand. If it cannot be sourced, **do not build the
> section** — an unsourced problem section is worse than none, because it
> invites the scrutiny that a credentials-led site otherwise avoids.

---

### 3. Her Name Is… — Person — NEW

**Purpose:** the identifiable victim. The highest-value section on the page and
currently absent.

**Draft structure:**
> **[Full-bleed portrait, static, never a carousel]**
>
> *"One quote, 25–40 words, in her own words. What happened. What changed. What she wants next."*
>
> **Her name. Her ward. What she does now.**
>
> [One outcome metric tied to her — e.g. the group she leads, the sessions she has attended]
>
> [ Secondary link: Read another story ]

**Focal element & visual weight:** highest on the page. Full-bleed portrait,
largest single image, generous whitespace above and below so nothing competes.

**Psychological trigger:** identifiability + agency. The framing must be
"she is now a leader in her community", not "she is a victim". Pity does not
convert; recognition and respect do. This is also the only honest way to work
with GBV survivors — a survivor is a person with a name and a project, not an
illustration.

**Directional cue:** the outcome line points forward; a thin rule carries the eye
to the proof section.

> **⚠ Consent and safety — non-negotiable.** These are GBV survivors in a county
> where the risk of retraumatisation and of exposure is real. This requires:
> informed, revocable, documented consent; her control over her own name, image,
> and words; a genuine option to be anonymous; and a decision about whether she
> can be identified *to her community* at all. **Do not publish a story, a photo
> or a quote from a survivor without this process.** If the process cannot be
> done properly, the correct action is to feature a *community member in an
> active role* instead — someone with no exposure risk — and keep the structure.

---

### 4. What We Do — Context

**Keep, demoted.** The six programmes are institutional credibility, which is
correct *after* the reader has a reason to care and *before* the ask. Reframe
each programme as "this is what her quote above is made of" rather than a
catalogue. The featured/non-featured card treatment you already have is good —
keep it.

**Psychological trigger:** competence signalling. "They know what they are doing."
Secondary: specificity — six named areas beat "holistic empowerment".

---

### 5. Impact — Validation

**Keep the 35,500. Reframe it honestly.**

This is the section most likely to be scrutinised, because it is the section
that makes the numeric claim. Institutional donors and literate-donor
organisations both check whether reach is being passed off as outcome.

**Recommended relabelling:**

| Now | Proposed | Why |
|---|---|---|
| "Estimated direct beneficiaries" | **People reached** | Plain language; accurate to what was counted |
| `35,500` headline | `35,500` + "people reached across 5 wards" | Names the unit and the geography |
| — | **Add verified outcome metrics separately** | Reach ≠ outcome. A ward with 2 functioning GBV response centres is a different claim from 8,000 people attending |

Add a visible qualifier: *"Reach figures are drawn from the project overview and
represent estimated direct beneficiaries, not independently verified outcomes."*
Keeping this on the page protects you; removing it does not.

**Psychological trigger:** specificity + verifiability. Naming the unit and the
ward is what separates a credible figure from a decorative one.

---

### 6. Field — Validation

**Keep. This is your strongest section and it is the most under-used.**

Live projects with real dates and real photos is the best proof asset you own,
and it is buried eighth. It is the section that demonstrates the work is
*current* rather than described.

You have 2 projects and 1 activity, and the two projects are dated
`Completed` and `Planned` — **there is no in-progress project**, so nothing on
the site currently demonstrates the work is ongoing. That is a content gap, not
a design one, and it is cheap to close: set a real start date and an
in-progress status on the work that is actually running. A single dated
in-progress project is worth more than a paragraph claiming the work is live.

Volume here compounds trust fastest — **publish one field update every two
weeks.** It is the cheapest credibility dividend available, and the admin
dashboard already exists to make it a five-minute job.

---

### 7. Give — Action — REBUILT

**Current:** one path, one high-friction form.

**Proposed: three tiers, ordered by commitment cost, with the lowest-friction
option physically first.**

#### Tier 1 — M-Pesa / USSD (lowest friction, highest local conversion)

For a grassroots organisation in Kisumu, **mobile money is the primary channel**
and a card-only checkout excludes most of your local donor base. Display the
USSD code as a large, high-contrast, copyable string — bigger than any other
text in the section. For a low-trust, low-bandwidth audience, a code that can be
dialled on any handset converts better than any form.

> **NEEDS INFRASTRUCTURE.** An M-Pesa paybill or Till number from Safaricom,
> plus STK-push or USSD integration. A plain USSD code needs no integration at
> all — just a number and a PDF/SMS instruction — so this tier is achievable
> immediately and should ship first.

#### Tier 2 — Recurring, card/bank (diaspora and international donors)

Default to **monthly**, not one-time. Present one-time as the secondary option
on equal footing, never de-emphasised to the point of looking unavailable.
Monthly retains at a materially higher rate, and a recurring donor is a
relationship rather than a transaction.

#### Tier 3 — Partner / Volunteer

The existing enquiry form, unchanged, as the final tier. It is correctly
positioned as the *highest*-commitment path.

**Focal element & visual weight:** the gold donate button, alone, on a
high-contrast card with generous whitespace — the "isolation" device from your
brief. One action, one colour, unmistakable.

> **Psychological trigger:** commitment consistency — the tier ordered so that
> doing the smallest thing first makes the larger thing feel continuous.

---

### 8–9. Partner & Contact — Action, institutional

**Keep both.** The partners section is doing real work for the institutional
audience and the enquiry form is the correct terminus for them. The enquiry form
asks for organisation, which is right for this tier and wrong as a universal
donation path — that mismatch is the leak.

---

## 5. Conversion & donation anchor strategy

### Colour exclusivity — the highest-value, lowest-cost change

Your brief asks that action colour be exclusive to CTAs. It currently is not:
deep green (`--color-brand`) is simultaneously the primary button fill, the
header, the ticker, the Ticker band, the Partners card, the featured programme
card and the Contact section. Green means "the organisation" *and* "click me", so
it means neither.

**Recommendation: reserve `--color-gold` (#d9a441) exclusively for donation
actions.**

- It is already in the palette, so this costs no new tokens.
- `--color-brand-900` text on it measures **7.15:1** — comfortably AA (verified in
  the contrast audit behind the recent colour fixes).
- Green stays free to mean "the organisation". Gold stops being decoration and
  starts meaning "act here".

Caveat: gold is currently used for small decorative accents (rules, the ✦, the
progress hairline, the logo motif). Strip those to `brand-600` or keep them as
`gold-soft` and the reservation becomes real. Otherwise a visitor sees gold in
eleven places and it means nothing at the twelfth.

### Impact units — and the data gap that blocks them

Concrete outcome anchors ("£25 feeds a family for a month") are the strongest
conversion device available to you, and **you cannot write one yet**, because
the site contains no cost data of any kind.

This is the point to be strict about. A fabricated cost-per-outcome is the
fastest way to lose a donor and fail a due-diligence check — literate-donor
organisations compute exactly this figure. Do not estimate it.

**You have one derivable number.** From what already exists:

```
cost per beneficiary = total programme spend ÷ 35,500
```

If you can supply total annual programme spend, that single division yields a
real, defensible unit cost, and every anchor becomes writable:

- *"£X funds one participant's full GBV support pathway — counselling, medical
  care, legal aid and referral."*
- *"£Y supports one ward's health-outreach month."*

Two requirements for these to work:
1. **Named unit, defined scope.** Not "helps a woman" — the specific services
   bundled into the unit, so the claim is checkable.
2. **Keep the unit stable.** If £X changes silently next quarter, every prior
   claim you made is retroactively false. Set it annually and hold it.

**Interim alternative that needs no cost data:** offer *non-monetary* tiers
alongside the money ones — time, a share, a corporate introduction, a donated
good. "Give two hours" and "introduce one organisation" convert a genuinely
different audience (locals and diaspora) at zero cost to you.

### Where the anchors go

| Placement | Anchor | Rationale |
|---|---|---|
| Hero, secondary | "Give monthly" | Only major sites convert from the hero; keep it below the primary CTA |
| After the Person section | "Help someone like her" | Peak emotional arousal — the highest-response position on the page |
| Impact section, foot | "See what your gift does" | Pairs the unit with the reach figure |
| Give section | All tiers, full detail | The only place with the complete picture |
| Sticky mobile bar | M-Pesa code | Persistent, zero-friction, appears after first scroll |

### Form design

- Ask for the **least that lets you fulfil the gift.** Money first; email only if
  a receipt or update is genuinely needed. Every extra field on a donation form
  costs completions.
- **Default to monthly**, one-time equally available.
- Pre-select nothing that costs money implicitly (no pre-ticked gift wrap).
- Show the **total** a recurring gift implies ("£5/month = £60 a year") — it
  reduces the sticker shock that kills monthly gifts at the second charge.
- Keep the honeypot and validation you already built. They are good.

### Trust signals you already have and never render

`site.ts` defines **`registrationNumber`** and **`mapUrl`**, and neither is
imported or displayed anywhere. For an organisation asking for money in Kenya,
a visible registration number is a direct trust multiplier — NGO registration is
checkable, and its absence reads as evasive. Render it next to the donation
anchor, alongside the physical address and phone numbers you just added.

---

## 6. Phasing

**Phase 1 — no new infrastructure. Do this now.**
Remove/demote the Ticker · single hero CTA · Person section using a *community
member in an active role* (no consent risk) · **mark a real in-progress project**
· relabel reach vs outcome · add the registration number and address to the Give
block · publish a field update every two weeks · move Field above the ask.

**Phase 2 — needs a payment provider.**
M-Pesa paybill or Till number displayed as a USSD code (no integration
required — this is the single highest-value item in Phase 2 and the cheapest) ·
STK push · card checkout with monthly default.

**Phase 3 — needs cost data.**
Obtain total programme spend · compute cost per beneficiary · publish the unit
definition · ship the impact calculator and the outcome anchors · add verified
outcome metrics to sit alongside reach.

**Phase 4 — once the Person process exists.**
Consented survivor stories, one at a time, with a documented consent protocol.

---

## 7. What I would not do

- **Do not invent the problem statistics.** See §4. Source them or skip the
  section.
- **Do not invent cost-per-outcome.** Compute it or omit it.
- **Do not lead with 35,500.** Lead with a person; the number becomes credible
  *after* the reader cares who they are counting.
- **Do not build a slider or calculator** without cost data — an impact
  calculator that multiplies a made-up constant is worse than no calculator,
  because it performs arithmetic in public.
- **Do not add urgency or scarcity you cannot substantiate.** Fabricated
  countdown timers on an NGO donation page are a recognised pattern that donors
  read as manipulation, and they cost more than they raise.
