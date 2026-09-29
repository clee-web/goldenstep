/**
 * Canonical Golden Steps content.
 *
 * Sourced from the Golden Steps project overview deck. This module is the single
 * source of truth: the React client imports it directly for static rendering, and
 * the Express API re-exports it from GET /api/programmes. Edit content here only.
 */

import { programmeIds, type ProgrammeId } from './schemas.ts';

// Re-exported so existing `content.ts` importers keep working while the id
// type itself lives next to the list it is derived from.
export { programmeIds };
export type { ProgrammeId };

export interface ProgrammeActivity {
  title: string;
  description: string;
}

export interface Programme {
  id: ProgrammeId;
  number: string;
  name: string;
  /** Short line used on the programme card. */
  summary: string;
  /** Longer positioning statement used on the detail view. */
  description: string;
  /** Glyph rendered in the card's icon slot. */
  icon: string;
  /** Three headline activities surfaced on the card. */
  highlights: string[];
  activities: ProgrammeActivity[];
  beneficiaries: number;
  image: string;
  imageAlt: string;
  caption: string;
}

/**
 * One named human, used at the head of the "Proof, in people" chapter.
 *
 * This is the identifiable-victim beat, and it is the single highest-leverage
 * thing on the site: a face before the aggregate is what turns a category-level
 * impression ("NGOs help people") into a specific obligation. The photographs
 * in the gallery cannot do this, because a carousel auto-advances and so
 * physically prevents the dwell time the effect depends on.
 */
export interface PersonStory {
  /**
   * Her name, as she has agreed to be named. Empty string where she has chosen
   * anonymity — see `anonymous` below before assuming this is always present.
   */
  name: string;
  /**
   * Set true when she has not consented to being named. The component then
   * renders her role instead of her name and drops `name` from the accessible
   * name of the image. Anonymity is a legitimate outcome of a consent process,
   * not a failure of it.
   */
  anonymous: boolean;
  /** What she does now — the dignity framing. "Survivor" alone is not a role. */
  role: string;
  /** Her ward, or the group she belongs to. Geographic specificity. */
  context: string;
  /**
   * Her words, in her own voice: what happened, what changed, what she wants
   * next. 25–40 words. Not a summary written about her, and not a sentence
   * crafted for effect — a composed line is the thing donors detect and it
   * costs more trust than the section earns.
   */
  quote: string;
  /** One outcome tied to her specifically, not to the programme. */
  outcome: string;
  image: string;
  /** Describes the image, not the person, if she is not to be identified. */
  imageAlt: string;
}

export const organisation = {
  name: 'Golden Steps',
  mark: 'GS',
  tagline: 'Shaping today for a better tomorrow',
  founded: '2023',
  descriptor: 'Grassroots women-led organization',
  /**
   * The county, not the sub-county.
   *
   * This is the top bar's provenance line, and it states the scale Golden Steps
   * actually works at. `about.footprint` deliberately carries both scales — the
   * county as the claim, "Kisumu East Sub County" as the label on the five wards
   * the published figures are collected in — so the two are not in tension and
   * this should not be narrowed back to the sub-county to "match" it.
   */
  location: 'Kisumu County',
} as const;

/*
 * `hero` is declared further down. Its carousel uses the dedicated
 * hero1–hero7 photographs; the organic frame lives on the component.
 */

/*
 * The thematic marquee that used to sit directly under the hero has been
 * removed, and this list with it. Its six entries are the same six rendered as
 * programme cards in chapter 04, so the top of the page was spending its
 * highest-attention position restating a list the reader meets properly three
 * scrolls later. Restore from version control if it is ever wanted back.
 */

export const about = {
  eyebrow: 'Who we are',
  title: 'Rooted in community.',
  titleAccent: 'Driven by dignity.',
  lead: 'Golden Steps is a grassroots women-led organization, formed in 2023, to support vulnerable and marginalized groups.',
  body: [
    "We're experts in GBV prevention, referral, trauma counselling and legal aid, alongside economic empowerment, health awareness, climate change and innovation. We partner with youth, vulnerable women and communities to live free from violence and inequality.",
    'We believe in safe, inclusive, empowered communities.',
  ],
  cta: { label: 'Discover our approach', href: '#approach' },
  footprint: {
    title: 'Our footprint',
    /*
     * The county is the claim; Kisumu East is where the ward-level data below
     * was collected. They are different scales of the same truth, and stating
     * both keeps the site honest: Golden Steps works across Kisumu County, and
     * the figures it publishes are from the five Kisumu East wards listed here.
     */
    county: 'Kisumu County',
    subCounty: 'Kisumu East Sub County',
    wards: ['Manyatta B', 'Nyalenda A', 'Kolwa Central', 'Kolwa East', 'Kajulu'],
  },
} as const;

export const programmesIntro = {
  eyebrow: 'What we do',
  title: 'Six pathways to',
  titleAccent: 'lasting change.',
  lead: 'Our thematic areas connect immediate support with long-term community resilience, equality and opportunity.',
} as const;

export const programmes: Programme[] = [
  {
    id: 'gender',
    number: '01',
    name: 'Gender & GBV Prevention',
    summary:
      'Survivor-centred services, prevention, referral, education, advocacy and safe spaces.',
    description:
      'Promote equality and reduce Gender-Based Violence through prevention, survivor-centred response, empowerment and engagement.',
    icon: '♡',
    highlights: ['FGBV sensitization', 'Referral pathway', 'Intersectionality'],
    activities: [
      {
        title: 'Supporting survivors through identification, response and referral',
        description:
          'Identifying survivors early, responding to immediate needs and walking each person through referral to services.',
      },
      {
        title: 'FGBV sensitization & referral',
        description:
          'Community sensitization on femicide and gender-based violence, and a clear referral pathway into response.',
      },
      {
        title: 'Intersectionality',
        description:
          'Recognising how gender compounds with disability, poverty, age and other identities to shape risk.',
      },
      {
        title: "Women's leadership training",
        description: 'Building skills, confidence and leadership capacity.',
      },
      {
        title: 'Creating supportive environments — safe spaces',
        description:
          'Safe spaces where vulnerable women and girls can be referred to, and where they are able to be.',
      },
      {
        title: 'Male engagement forums',
        description: 'Encouraging positive masculinity and shared responsibility.',
      },
    ],
    beneficiaries: 6000,
    image: '/assets/Picture1.png',
    imageAlt: 'Community dialogue session with survivors and local leaders',
    caption:
      'Community dialogue sessions where survivors and leaders shape the response together.',
  },
  {
    id: 'health',
    number: '02',
    name: 'Health',
    summary:
      'Preventive and promotive health services for vulnerable households and communities.',
    description:
      'Improve access to preventive and promotive health services among vulnerable households, with prevention, access and empowerment at the centre.',
    icon: '＋',
    highlights: ['Health education', 'HIV prevention & referral', 'Emerging issues'],
    activities: [
      {
        title: 'Health education & emerging issues',
        description:
          'Hygiene, nutrition and disease prevention, including the health issues communities are not yet talking about.',
      },
      {
        title: 'HIV prevention & referral',
        description:
          'HIV prevention, testing awareness and referral into treatment and ongoing care.',
      },
      {
        title: 'Access to services',
        description:
          'Linking communities to health facilities and supporting mobile clinics and community health workers.',
      },
      {
        title: 'Reproductive & maternal health',
        description: 'Supporting contraception choice, antenatal care and safe childbirth.',
      },
      {
        title: 'Mental health & PSS',
        description: 'Reducing stigma through community-based support systems.',
      },
    ],
    beneficiaries: 8000,
    image: '/assets/Picture2.png',
    imageAlt: 'Door-to-door health education session led by community health workers',
    caption:
      'Health education and awareness driven door-to-door by community health workers.',
  },
  {
    id: 'child',
    number: '03',
    name: 'Child Protection',
    summary: 'Protecting children from abuse, neglect, exploitation and violence.',
    description:
      'Protect children from abuse, neglect, exploitation and violence through community and school-based mechanisms.',
    icon: '♧',
    highlights: ['Identification & referral', 'CP units', 'Safeguarding'],
    activities: [
      {
        title: 'Identification & referral in child protection',
        description:
          'Identifying children at risk and connecting them to the right response.',
      },
      {
        title: 'Child protection units & life skills',
        description:
          'Working through CP units alongside life skills work for children in and out of school.',
      },
      {
        title: 'Safeguarding',
        description:
          'Safeguarding policy and practice across programmes, partners and community structures.',
      },
      {
        title: 'Rehabilitation & re-integration',
        description:
          'Supporting children to return to family, school and community after separation or harm.',
      },
      {
        title: 'Access to justice for children',
        description:
          'Connecting children to justice processes and representing their interests.',
      },
      {
        title: 'Parenting skills',
        description: 'Supporting safer, more protective family environments.',
      },
    ],
    beneficiaries: 5000,
    image: '/assets/Picture3.png',
    imageAlt: 'School protection club session with children',
    caption:
      'School protection clubs creating safe spaces for children to speak up.',
  },
  {
    id: 'economic',
    number: '04',
    name: 'Economic Empowerment',
    summary:
      'Skills, resources and opportunities that strengthen household income and resilience.',
    description:
      'Enable individuals and communities to achieve self-reliance and improved livelihoods through skills, resources and opportunities.',
    icon: '↗',
    highlights: ['VSLA', 'Poultry farming', 'Bakery'],
    activities: [
      {
        title: 'VSLA (Village Savings and Loaning Association)',
        description:
          'Village savings groups that build capital and lending capacity within the community itself.',
      },
      {
        title: 'Bakery & pastry skills',
        description:
          'Training in pastry and cake making so participants own a marketable skill they can earn from.',
      },
      {
        title: 'Poultry farming',
        description: 'Poultry production as a practical route to household income and nutrition.',
      },
      {
        title: 'Entrepreneurship & financial literacy',
        description: 'Business basics, record keeping and financial literacy alongside the skills.',
      },
      {
        title: 'Women & youth empowerment',
        description:
          'Targeted programmes for marginalized groups to participate in economic activities.',
      },
    ],
    beneficiaries: 3500,
    image: '/assets/Picture4.png',
    imageAlt: 'Savings group and vocational skills session',
    caption:
      'Savings groups and vocational skills turning potential into dependable livelihood.',
  },
  {
    id: 'justice',
    number: '05',
    name: 'Social Justice',
    summary:
      'Amplifying community voices, advancing human rights and strengthening accountability.',
    description:
      'Promote accountability, inclusion, human rights and citizen participation so marginalized and vulnerable groups have a voice and access to opportunity and services.',
    icon: '◌',
    highlights: ['Mediation', 'Legal aid', 'Access to justice'],
    activities: [
      {
        title: 'Mediation',
        description:
          'Structured mediation resolving disputes between households and within communities before they escalate.',
      },
      {
        title: 'Access to justice',
        description: 'Legal aid, legal awareness and support through justice processes.',
      },
      {
        title: 'Advocacy & rights awareness',
        description: 'Education on human rights, legal frameworks and civic participation.',
      },
      {
        title: 'Inclusion & equity',
        description:
          'Addressing discrimination based on ethnicity, disability, gender or socioeconomic status.',
      },
      {
        title: 'Community mobilization',
        description: 'Building collective action to hold duty bearers accountable.',
      },
    ],
    beneficiaries: 5000,
    image: '/assets/Picture6.png',
    imageAlt: 'Community scorecard session with local leaders',
    caption:
      'Community scorecards and advocacy holding duty bearers to account.',
  },
  {
    id: 'climate',
    number: '06',
    name: 'Climate Change',
    summary: 'Building awareness, resilience and community-led adaptation strategies.',
    description:
      'Build awareness, resilience and adaptation strategies that help communities mitigate and respond to the impacts of climate change.',
    icon: '☘',
    highlights: ['Community clean-up', 'Adaptation', 'Tree planting'],
    activities: [
      {
        title: 'Community clean-up',
        description:
          'Community-led environmental clean-up and waste management, keeping shared spaces usable.',
      },
      {
        title: 'Environmental education',
        description: 'Raising awareness about sustainable practices and conservation.',
      },
      {
        title: 'Adaptation & resilience',
        description:
          'Promoting climate-smart agriculture, water conservation and disaster preparedness.',
      },
      {
        title: 'Community-led conservation',
        description: 'Supporting sustainable management of forest, water and land.',
      },
      {
        title: 'Advocacy & policy engagement',
        description:
          'Influencing local policies for climate justice and environmental protection.',
      },
    ],
    beneficiaries: 8000,
    image: '/assets/Picture5.png',
    imageAlt: 'Community tree planting and water conservation activity',
    caption:
      'Tree planting and water conservation led by the communities themselves.',
  },
];

/**
 * The hero carousel.
 *
 * Dedicated stills (`hero1`–`hero7`) rotate inside the organic frame in `Hero`.
 * The shape is a property of that frame, not of any one photograph.
 */
export const hero = {
  eyebrow: 'Walking alongside communities',
  title: 'Every step toward empowerment matters.',
  titleAccent: 'empowerment',
  lead: 'Golden Steps works with women, youth and communities to live free from violence and inequality — building safer, healthier and more empowered communities.',
  primaryCta: { label: 'Explore our work', href: '#programs' },
  secondaryCta: { label: 'Partner with us', href: '#contact' },
  trust: 'Women • Youth • Communities',
  images: [
    {
      src: '/assets/hero1.jpeg',
      alt: 'Golden Steps team standing together outside the Golden Steps C.B.O. compound',
      tag: 'Our team',
    },
    {
      src: '/assets/hero2.jpeg',
      alt: 'Golden Steps staff and partners gathered at the organisation office',
      tag: 'Partners',
    },
    {
      src: '/assets/hero3.jpeg',
      alt: 'Two Golden Steps team members standing beside the organisation banner',
      tag: 'Who we are',
    },
    {
      src: '/assets/hero4.jpeg',
      alt: 'Community members receiving sanitary pads at an outdoor Golden Steps outreach',
      tag: 'Outreach',
    },
    {
      src: '/assets/hero5.jpeg',
      alt: 'Girls and young women raising packs of sanitary pads at a community distribution',
      tag: 'Dignity kits',
    },
    {
      src: '/assets/hero6.jpeg',
      alt: 'Children and young people seated under a tent during a Golden Steps community session',
      tag: 'Community session',
    },
    {
      src: '/assets/hero7.jpeg',
      alt: 'Young people holding up sanitary pads together after a Golden Steps distribution',
      tag: 'Young people',
    },
  ],
  visionCard: { title: 'Safe. Inclusive. Empowered.', subtitle: 'Our community vision' },
} as const;

/**
 * The person at the head of the "Proof, in people" chapter.
 *
 * Deliberately `null`. The section is built and waiting; publishing a story
 * into it is a consent process, not a copy task, and it should not be able to
 * happen by accident while writing.
 *
 * Before setting this, note what is being agreed to. If the subject is a
 * survivor of gender-based violence — which is who this organisation exists for
 * — then publishing her name, image and words can expose her to retraumatisation
 * or to people who harmed her, in a county where that risk is real. That needs
 * informed, documented, revocable consent, her control over how she is
 * identified, and a real option to be anonymous. The consent has to precede the
 * photograph, not follow it.
 *
 * If that process cannot be done properly, the right answer is not to publish
 * her at all. Feature a community member in an active role instead — a group
 * leader, a survivor advocate, someone with no exposure risk — and keep the
 * structure. Anonymity and a lesser subject are both better than a
 * half-consented one.
 *
 * See `docs/CONVERSION-STRATEGY.md` §4.3.
 */
export const person: PersonStory | null = null;

export const gallery = {
  eyebrow: 'From the field',
  title: 'Moments that',
  titleAccent: 'move us.',
  lead: 'Photographs from our community work across Kisumu East — every frame is a partnership, not a photo op.',
  slides: programmes.map((programme) => ({
    id: programme.id,
    image: programme.image,
    alt: programme.imageAlt,
    tag: programme.name,
    caption: programme.caption,
  })),
  whyWorkWithUs: {
    image: '/assets/why work with us.png',
    alt: 'Illustration accompanying the reasons to partner with Golden Steps',
  },
} as const;

export const impact = {
  eyebrow: 'Impact at a glance',
  title: 'Turning',
  titleAccent: 'action',
  titleAccentLine2: 'into opportunity.',
  lead: "The project overview identifies estimated direct beneficiaries across Golden Steps' six programme areas. Reach is not outcome: this is the number of people the work touches, not a verified count of lives changed.",
  /*
   * "People reached" rather than "beneficiaries". The word implies a verified
   * change in circumstance; what the project overview actually counts is
   * contact. The lead now says so explicitly, because an institutional donor
   * will compute the difference anyway and finding it stated is what keeps the
   * figure credible.
   */
  totalLabel: 'People reached',
  totalCaption: 'Across five wards in Kisumu East',
  metrics: programmes.map((programme) => ({
    id: programme.id,
    label: programme.name === 'Gender & GBV Prevention' ? 'Gender' : programme.name,
    value: programme.beneficiaries,
  })),
} as const;

export const approach = {
  eyebrow: 'Our approach',
  title: 'Solutions are stronger when',
  titleAccent: 'communities lead.',
  lead: 'We employ participatory development — working hand-in-hand with local communities, institutions and partners to co-create sustainable solutions.',
  visual: {
    word: 'COMMUNITY',
    wordAccent: 'LED',
    steps: ['Listen', 'Co-create', 'Act', 'Learn'],
  },
  principles: [
    {
      number: '01',
      title: 'Inclusivity',
      body: 'We prioritise inclusion, dignity and accountability in all our programmes.',
    },
    {
      number: '02',
      title: 'Intersectionality',
      body: 'We recognise how gender, age, status, violence and economic exclusion intersect.',
    },
    {
      number: '03',
      title: 'Participation',
      body: 'Local knowledge and community voices shape the solutions we support.',
    },
  ],
} as const;

export const vision = {
  eyebrow: 'Our vision',
  quote:
    'A thriving community where every step taken leads to empowerment, dignity and sustainable growth.',
  /*
   * The mission reads as one sentence directly under the vision, rather than as
   * a card competing with the values beside it. That was the original problem:
   * vision, mission and values were three equal blocks, and the reader got no
   * sense of which one the organisation actually leads with. Stacked, the order
   * carries the meaning — where we are going, what we do about it, what holds us
   * to it — and the display type is free to do the work on the vision alone.
   */
  mission: {
    label: 'Our mission',
    body: 'To empower individuals and groups through community driven initiatives that promote social welfare, equality, health and economic empowerment for sustainable development.',
  },
  values: {
    label: 'Our values',
    items: ['Integrity', 'Equity', 'Accountability', 'Innovation'],
  },
} as const;

export const partners = {
  eyebrow: 'Collaboration',
  title: 'Change grows through',
  titleAccent: 'partnership.',
  lead: 'Golden Steps works with government departments, county and national government, CSOs, NGOs and social services to connect people to services and strengthen collective action.',
  types: [
    { name: 'Department of Health', sub: '' },
    { name: 'DCS', sub: "Children's Services" },
    { name: 'Trade', sub: '' },
    { name: 'Agriculture', sub: '' },
    { name: 'Education', sub: '' },
    { name: 'Social Services', sub: '' },
    { name: 'CSOs', sub: '' },
    { name: 'NGOs', sub: '' },
    { name: 'County', sub: 'Government' },
    { name: 'National', sub: 'Government' },
  ],
  cta: {
    eyebrow: 'Why partner with us?',
    title:
      'Invest in sustainable change: empowered individuals + strengthened communities.',
    label: 'Start a conversation',
    href: '#contact',
  },
} as const;

/**
 * Chapter 11 copy. The documents themselves are managed from the admin
 * dashboard and arrive from `GET /api/content`; these are the static strings the
 * section falls back to, and the one line that says why they are public.
 */
export const policies = {
  eyebrow: 'Our policies',
  title: 'How we hold',
  titleAccent: 'ourselves to account.',
  lead: 'Our safeguarding, child protection and governance documents are published here in full. Read them, download them, and hold us to them.',
  empty: 'Policy documents will be listed here. Upload them from the admin dashboard.',
  download: 'Download PDF',
} as const;

/**
 * The donation anchor.
 *
 * An M-Pesa paybill needs no payment provider, no integration and no card
 * processor, which is why it ships while everything else in Phase 2 of
 * `docs/CONVERSION-STRATEGY.md` is still blocked. For a grassroots organisation
 * in Kisumu, mobile money is the primary channel: a card-only checkout would
 * exclude most of the local donor base entirely.
 *
 * There are deliberately no "what your gift does" outcome lines here. Those need
 * cost-per-outcome data, the site has none, and an invented unit cost is the
 * fastest way to fail a donor's due-diligence check.
 */
export const donate = {
  eyebrow: 'Give',
  title: 'Help us shape today for',
  titleAccent: 'a better tomorrow.',
  lead: 'Golden Steps is grassroots and community-led. Contributions go to the programmes described above — GBV response and referral, health, child protection, economic empowerment, social justice and climate action — in Kisumu East.',
  mpesa: {
    label: 'M-Pesa',
    /* Spelled "paybill" by Safaricom, and that is the label on their handset. */
    paybillLabel: 'Paybill number',
    paybill: '344500',
    accountLabel: 'Account number',
    account: '000043',
    /*
     * Safaricom's USSD short code for a paybill. Dialled on any handset with no
     * data connection, which is the point: it works on the cheapest phone in the
     * room and needs no app, no account and no card.
     */
    ussd: '',
  },
  steps: [
    'On your phone, open M-Pesa and choose Lipa na M-PESA (Pay Bill).',
    'Enter the paybill number below.',
    'Enter the account number below.',
    'Enter your amount, then confirm to complete the contribution.',
  ],
  note: 'Reference your name or phone number so we can acknowledge your gift and send you updates.',
} as const;

export const contact = {
  eyebrow: 'Get involved',
  title: 'Take the next',
  titleAccent: 'step.',
  lead: 'Whether you are a donor, institutional partner, social enterprise, community organization or supporter, there is room to collaborate.',
  topics: [
    'Partnership',
    'Funding / donor support',
    'Community programme',
    'Volunteering',
    'General enquiry',
  ],
} as const;

/**
 * Chapter 07 copy. The projects and activities themselves are managed from the
 * admin dashboard and arrive from `GET /api/content`; these are the static
 * defaults used before that request resolves, and whenever it fails.
 */
export const field = {
  eyebrow: 'From the field',
  title: 'Recent work,',
  titleAccent: 'as it happens.',
  lead: 'Live projects and the latest activity from our teams across Kisumu East. Updated as the work moves.',
  projectsTitle: 'Recent projects',
  activitiesTitle: 'Latest activity',
  emptyProjects: 'No projects published yet. Add the first one from the dashboard.',
  emptyActivities: 'No activity published yet. Add the first update from the dashboard.',
} as const;

export interface NavChild {
  label: string;
  href: string;
  /** One line of real copy, so a menu item says what the reader will find. */
  description: string;
}

export interface NavGroup {
  id: string;
  label: string;
  href: string;
  /** Absent on the call to action, which is a direct link with no menu. */
  children?: readonly NavChild[];
}

/**
 * The header's four top-level items. Nine flat section links was more menu than
 * a reader can hold in their head, so the sections are grouped into the four
 * questions the page actually answers: who we are, what we do, what that changed,
 * and how to join. `href` is always a real section id, which is what lets every
 * trigger stay a plain link that navigates on click.
 */
export const navGroups: readonly NavGroup[] = [
  {
    id: 'who-we-are',
    label: 'Who we are',
    href: '#about',
    children: [
      {
        label: 'About',
        href: '#about',
        description:
          'A grassroots, women-led organization formed in 2023 to support vulnerable groups.',
      },
      {
        label: 'Vision & Mission',
        href: '#vision',
        description:
          'The vision, mission and values we hold ourselves to — integrity, equity, accountability.',
      },
      {
        label: 'Our Approach',
        href: '#approach',
        description:
          'Participatory development, co-created with communities rather than delivered to them.',
      },
      {
        label: 'Our Team',
        href: '#team',
        description: 'Meet the dedicated individuals who drive Golden Steps forward every day.',
      },
      {
        label: 'Our Policies',
        href: '#policies',
        description: 'Our safeguarding, child protection and governance documents, published in full.',
      },
    ],
  },
  {
    id: 'what-we-do',
    label: 'What we do',
    href: '#programs',
    children: [
      {
        label: 'Our Programmes',
        href: '#programs',
        description:
          'Six thematic areas joining immediate support to long-term resilience and opportunity.',
      },
      {
        label: 'Field Work',
        href: '#field',
        description: 'Live projects and the latest activity from our teams across Kisumu East.',
      },
    ],
  },
  {
    id: 'our-impact',
    label: 'Our impact',
    href: '#impact',
    children: [
      {
        label: 'Stories',
        href: '#stories',
        description: 'Photographs from our community work — every frame a partnership, not a photo op.',
      },
      {
        label: 'Impact',
        href: '#impact',
        description: 'The estimated direct beneficiaries across all six of our programme areas.',
      },
      {
        label: 'Testimonials',
        href: '#testimonials',
        description: 'Stories from community members and partners about our work.',
      },
      {
        label: 'Our Partners',
        href: '#partners',
        description: 'The Ministry of Health, NGOs, local leaders and community health partners.',
      },
    ],
  },
  {
    id: 'get-involved',
    label: 'Get involved',
    href: '#contact',
  },
];

/**
 * The page is written as a single narrative rather than a set of independent
 * blocks: who we are, why we exist, how we work, what we do, proof in people,
 * proof in scale, who we do it with, and finally the invitation to the reader.
 *
 * `bridge` is the handoff line rendered at the foot of each chapter, so the
 * reader is always told what the next step of the story is before they reach it.
 * This ordering is what turns scrolling into reading.
 */
export interface Chapter {
  id: string;
  step: string;
  label: string;
  /** Rendered at the end of this chapter to hand off to the next one. */
  bridge: string;
  /** Announced to screen readers as the reader enters the chapter. */
  summary: string;
}

export const chapters: Chapter[] = [
  {
    id: 'about',
    step: '01',
    label: 'Who we are',
    summary: 'A grassroots women-led organization formed in 2023 in Kisumu East.',
    bridge: 'And out of that grew something we could put a name to.',
  },
  {
    id: 'vision',
    step: '02',
    label: 'Why we exist',
    summary: 'The vision and mission we hold ourselves to.',
    bridge: 'But a vision only holds if the method underneath it holds.',
  },
  {
    id: 'approach',
    step: '03',
    label: 'How we work',
    summary: 'Participatory development, co-created with communities.',
    bridge: 'This is how that approach actually reaches people.',
  },
  {
    id: 'programs',
    step: '04',
    label: 'What we do',
    summary: 'Six programme areas across gender, health, child protection, livelihoods, justice and climate.',
    bridge: 'And this is what it looks like in practice.',
  },
  {
    id: 'stories',
    step: '05',
    label: 'Proof, in people',
    summary: 'Photographs from our community work across Kisumu East.',
    bridge: 'Every frame is a person. Together, they are a number.',
  },
  {
    id: 'impact',
    step: '06',
    label: 'Proof, in scale',
    summary: 'The estimated reach of our six programme areas.',
    bridge: 'And that reach is not a snapshot — it is moving right now.',
  },
  {
    id: 'field',
    step: '07',
    label: 'From the field',
    summary: 'Recent projects and the latest activity from our teams.',
    bridge: 'And every one of those projects rests on the people beside us.',
  },
  {
    id: 'team',
    step: '08',
    label: 'Our team',
    summary: 'The dedicated individuals who drive Golden Steps forward every day.',
    bridge: 'Their work speaks for itself.',
  },
  {
    id: 'testimonials',
    step: '09',
    label: 'Voices of change',
    summary: 'Stories from community members and partners about our impact.',
    bridge: 'And this work is made possible through partnership.',
  },
  {
    id: 'partners',
    step: '10',
    label: 'Who we work with',
    summary: 'Government, community health structures, NGOs and local leaders.',
    bridge: 'And here is how we hold ourselves to account.',
  },
  {
    id: 'policies',
    step: '11',
    label: 'Our policies',
    summary: 'Our safeguarding, child protection and governance documents, published in full.',
    bridge: 'Which brings the next step to you.',
  },
  {
    id: 'contact',
    step: '12',
    label: 'Take the step',
    summary: 'How to partner with, fund or volunteer with Golden Steps.',
    bridge: '',
  },
];

export const totalBeneficiaries = programmes.reduce(
  (sum, programme) => sum + programme.beneficiaries,
  0,
);
