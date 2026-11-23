/**
 * Content types. These describe the SHAPE of everything in content.ts.
 * Editing content never requires changing this file; adding a new kind of
 * field does.
 */

import type { AnimationConfig } from "../lib/animation/config";

/* ---------------------------------------------------------------- Sections */

export type SectionId =
  | "loader"
  | "hero"
  | "intro"
  | "proof"
  | "experience"
  | "research-work"
  | "leadership"
  | "honours"
  | "beyond"
  | "resume"
  | "contact"
  | "footer";

export interface SectionConfig {
  id: SectionId;
  /** Heading shown at the top of the section. */
  title: string;
  /** Small label above the heading (optional). */
  eyebrow?: string;
  /** One supporting line under the heading (optional). */
  intro?: string;
  /** Label in the sticky navigation. Omit to keep the section out of the nav. */
  navLabel?: string;
  /** false hides the section (and its nav link) everywhere. */
  visible: boolean;
  /** Lower numbers render first. */
  order: number;
}

/* ---------------------------------------------------------- Status labels */

/** Research status. Changing it in content.ts updates every badge. */
export type ResearchStatus = "ongoing" | "completed" | "published";

/* --------------------------------------------------------------- Proof bar */

export interface ProofItem {
  /** Final display text, exactly as shown (also what screen readers get). */
  value: string;
  label: string;
  /** Optional one-line clarification under the label. */
  detail?: string;
  /**
   * Optional count-up for the numeric part of the value: shows
   * prefix + (0 → to) + suffix. Leave out for text or ranks (shown directly).
   */
  count?: { to: number; prefix?: string; suffix?: string };
  /**
   * Optional small dot grid at the foot of the card: "total" dots, of which
   * "lit" light up as the number counts (e.g. 22 of 216). Leave out for none.
   */
  dots?: { total: number; lit: number };
}

/* -------------------------------------------------------------- Experience */

export interface ExperienceItem {
  company: string;
  title: string;
  /** One-sentence description shown under the role. */
  summary: string;
  /** "current" = filled marker (latest role); "past" = outlined marker. */
  marker: "current" | "past";
  location: string;
  start: string;
  end: string;
  outcome: string;
  bullets: string[];
  tags: string[];
  note?: string;
}

/* -------------------------------------------------------- Project resources */

/** File types a project resource can be. "link" is an external URL. */
export type ResourceFileType = "ppt" | "pptx" | "xls" | "xlsx" | "pdf" | "doc" | "docx" | "link";

/**
 * What happens on click:
 *  - "open"      opens the file in a new tab (best for PDF)
 *  - "download"  downloads the file (best for PPT/XLS/DOC)
 *  - "external"  navigates to an outside URL in a new tab
 */
export type ResourceAction = "open" | "download" | "external";

export interface ProjectResource {
  title: string;
  description?: string;
  fileType: ResourceFileType;
  /**
   * Local files: a path relative to /public, e.g. "/projects/dfi-bond-portfolio/model.xlsx".
   * External links: a full URL starting with https://
   */
  href: string;
  action: ResourceAction;
  /** Optional button text. Defaults to "Open", "Download" or "Visit". */
  label?: string;
  /**
   * Optional PDF rendering of a PPT/PPTX/DOC file (e.g. produced by
   * `npm run convert:office`), shown in the internal viewer. Without it,
   * those formats offer the original download only.
   */
  preview?: string;
  /** Optional separate download address (e.g. a database attachment's ?download=1 link). */
  downloadHref?: string;
  /** Optional file name to display when `href` does not end in one. */
  fileName?: string;
}

/* ------------------------------------------------------------ Case studies */

export interface CaseResult {
  label: string;
  value: string;
  note?: string;
}

/** Project-specific interactive exhibit on a case-study page (only with documented data). */
export type CaseExhibit =
  | {
      kind: "rate-shock";
      /** Documented portfolio modified duration (years). */
      modifiedDuration: number;
      /** Documented portfolio convexity. */
      convexity: number;
      /** Documented result the illustration is anchored to. */
      anchor: { bp: number; change: string };
    }
  | { kind: "beta"; stocks: { name: string; beta: number; note: string }[]; caption: string }
  | { kind: "positions"; tickers: string[] }
  | { kind: "frameworks"; steps: { name: string; focus: string }[] };

export interface CaseStudy {
  /** The problem, mandate or objective. */
  context: string;
  /** What the portfolio owner actually contributed. */
  role: string;
  approach: string[];
  /** Verified results only. Empty = shown as "not yet published" with resultsNote. */
  results: CaseResult[];
  resultsNote?: string;
  /** Only when supported by project documentation; empty = section omitted. */
  learned: string[];
  exhibit?: CaseExhibit;
}

/* ---------------------------------------------------------------- Projects */

export interface Project {
  /** URL slug: /projects/<slug> */
  slug: string;
  /** Card picture (3:2, e.g. 1200 × 800), path inside /public. Decorative artwork, not data. null = no picture. */
  image?: string | null;
  /** Describes the picture for screen readers. */
  imageAlt?: string;
  /** Which part of the picture stays in view if it is cropped, e.g. "center", "top", "30% 50%". Default "center". */
  imagePosition?: string;
  title: string;
  shortTitle: string;
  context: string;
  date: string;
  role: string;
  summary: string;
  keyFacts: string[];
  /** Honest labels that must always be visible (e.g. "Paper trading"). */
  labels?: string[];
  /** Short category shown on the card, e.g. "Fixed income". */
  category: string;
  /** Shown as a badge on the card and case-study page. */
  status: "Completed" | "Ongoing";
  /** Optional free-text status shown on the card instead of `status` (from the admin dashboard). */
  statusLabel?: string;
  /** The full case-study page. Leave this out if the project has no case study. */
  caseStudy?: CaseStudy;
  /** Optional message pinned to the top of the case-study page while scrolling (e.g. "Paper trading · no real money"). */
  stickyNotice?: string;
  /** Optional files and links. Leave empty when there are none; the panel hides itself. */
  resources: ProjectResource[];
}

/* ------------------------------------------------------------------ Research */

export interface ResearchFinding {
  label: string;
  /** Exhibit heading, e.g. "Market size". */
  exhibit: string;
  before: { label: string; value: number };
  after: { label: string; value: number };
  unit: "lakh-crore" | "percent";
  /** Shared scale maximum for the paired bars (bars start at zero). */
  scaleMax: number;
  /** Named source, or undefined while the citation is pending. */
  source?: string;
}

export interface Research {
  /** URL slug: /research/<slug> */
  slug: string;
  /** Card picture (3:2, e.g. 1200 × 800), path inside /public. Decorative artwork, not data. null = no picture. */
  image?: string | null;
  /** Describes the picture for screen readers. */
  imageAlt?: string;
  /** Which part of the picture stays in view if it is cropped, e.g. "center", "top", "30% 50%". Default "center". */
  imagePosition?: string;
  title: string;
  fullTitle: string;
  status: ResearchStatus;
  mode: string;
  year: string;
  question: string;
  data: string;
  signals: string[];
  method: string;
  findings: ResearchFinding[];
  integrity: string;
  /** What is done, what is designed, what is still pending. */
  progress: { completed: string[]; planned: string[]; pending: string[] };
  resources: ProjectResource[];
}

/* -------------------------------------------------------------- Leadership */

export interface LeadershipItem {
  /** Card heading, e.g. "Toastmaster". */
  role: string;
  /** Small line under the heading: programme, place or date. */
  context: string;
  /** What was done (one or two sentences). */
  detail: string;
  /** One concise impact sentence, brightened when the card is hovered or focused. */
  impact?: string;
  /** Big figure on medium/small cards, e.g. "50+". */
  metric?: string;
  /** Words after the big figure, e.g. "students". */
  metricLabel?: string;
  /** Several figures (used on the large card). */
  stats?: { value: string; label: string }[];
  /** "large" = feature card, "medium" = wide card, "small" = compact card. */
  size: "large" | "medium" | "small";
}

/* ----------------------------------------------------- Honours & credentials */

export interface Honour {
  title: string;
  detail?: string;
  /** Kind of recognition, shown as a small label, e.g. "Professional", "Academic", "Competition", "Extracurricular". */
  category?: string;
}

export type CertificationCategory = "Finance" | "Analytics" | "Professional" | "Campus";

/** An area of a certificate that is blurred before publishing (fractions of the page, from the top-left). */
export interface Redaction {
  /** What is hidden, e.g. "signature" or "certificate number". */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
  /** Exact date shown on the card when known, e.g. "Jun 2026". */
  date?: string;
  category: CertificationCategory;
  /** Image path relative to /public (e.g. "/certificates/fintech.webp"), or null if not supplied yet. */
  image: string | null;
  /** Original PDF, JPG or PNG in /certificates-src (never published). `npm run certificates` renders it into "image". */
  source?: string;
  /** Private areas blurred when rendering (signatures, ID numbers, codes, family names). */
  redact?: Redaction[];
  /** File offered by "Download" (inside /public), or null for none. */
  download?: string | null;
  /** Credly or issuer verification URL, or null. Only real links. */
  verifyUrl: string | null;
  /** true = a real certificate whose document is deliberately not published (card shows title and dates only). */
  filePrivate?: boolean;
  /** false hides the card (e.g. until the certificate file and details are supplied). */
  visible?: boolean;
}

export interface EducationItem {
  qualification: string;
  /** Optional small line under the qualification (e.g. specialisation). */
  detail?: string;
  institute: string;
  board: string;
  years: string;
  score: string;
  /** Optional footnote marker explained in "notes", e.g. "*". */
  scoreNote?: string;
  badges?: string[];
}

/* -------------------------------------------------------- Beyond the classroom */

export interface BeyondItem {
  /** Stable unique id (lowercase-with-dashes). */
  id: string;
  title: string;
  /** Small label above the title, e.g. "Markets". */
  category?: string;
  /** One short, factual sentence. */
  caption: string;
  /** Photo path relative to /public. */
  image: string;
  /** Describes the photo for screen readers. */
  imageAlt: string;
  /** Which part of the photo stays in view when the frame trims it, e.g. "center", "70% 40%". */
  imagePosition?: string;
}

/* ------------------------------------------------------------------ Résumé */

export interface ResumeItem {
  label: string;
  /** Path relative to /public. */
  file: string;
  /** Name the browser saves the file as. */
  downloadName: string;
}

/* ----------------------------------------------------------------- Contact */

export interface ContactLink {
  kind: "email" | "phone" | "linkedin";
  label: string;
  value: string;
  href: string;
}

/* ===================================================================== */
/* CONTENT FILES — the shape of each file in the /content folder.        */
/* ===================================================================== */

interface ContentFile {
  /** Editor helper that powers hints and error checking. Leave it as it is. */
  $schema?: string;
}

/** content/site.json — page title and description used by search engines and link previews. */
export interface SiteFile extends ContentFile {
  /** Browser tab title. */
  title: string;
  /** One or two sentences shown in Google results and link previews. */
  description: string;
  /** Language/region code, e.g. "en_IN". */
  locale: string;
}

/** content/sections.json — which homepage sections show, their order, headings and menu labels. */
export interface SectionsFile extends ContentFile {
  sections: SectionConfig[];
}

export interface Person {
  /** Full name (used for the page heading and screen readers). */
  name: string;
  /** First line of the big Hero name. */
  firstNames: string;
  /** Second line of the big Hero name (shown in lavender italics). */
  highlightedName: string;
  /** Short monogram in the top-left of the menu bar. */
  monogram: string;
  pronouns: string;
  /** Shown under the Hero statement. */
  location: string;
  origin: string;
  status: string;
  /** Green label above the name. */
  statusLine: string;
  /** Specialisation line under the statement. */
  tagline: string;
  /** Main statement under the name. */
  brandLine: string;
  availability: string;
}

/** content/hero.json — the first screen: name, statement, buttons and portrait. */
/** The "Meet Pradosh" introduction video (hero.json → introVideo). */
export interface IntroVideo {
  /** Video file inside /public, e.g. "/videos/pradosh-introduction.mp4" (MP4, H.264 + AAC). */
  src: string;
  /** Still image shown before playing (a real frame from the video). */
  poster: string;
  /** Blurred image filling the sides of the wide frame around a portrait video. */
  backdrop?: string;
  /** "portrait" (9:16, e.g. a phone video) or "landscape" (16:9). */
  orientation: "portrait" | "landscape";
  /** Caption file (.vtt) inside /public, or null. */
  captions: string | null;
  /** Shown on the poster, e.g. "1:08". */
  duration: string;
  /** Hero link text, e.g. "Watch introduction". */
  watchLabel: string;
  /** Play button's accessible name. */
  playLabel: string;
  /** One sentence under the section heading. */
  description: string;
  /** Shown if the video file is missing. */
  missing: string;
}

export interface HeroFile extends ContentFile {
  person: Person;
  introVideo: IntroVideo;
  buttons: {
    /** Main button (scrolls to Research & Selected Work). */
    primary: string;
    /** Résumé download button. */
    secondary: string;
    /** Shown on the résumé button while the PDF is missing. */
    resumePendingNote: string;
  };
  portrait: {
    /** Photo path inside the /public folder, e.g. "/photos/headshot.webp". */
    image: string;
    /** Description of the photo for screen readers. */
    alt: string;
    /** The plain background colour of the photo (hex, e.g. "#8b868a"). It is left out of the dotted print. Update it if you change the photo. */
    backdropColor: string;
  };
}

/** content/proof.json — the strip of headline facts under the Hero. */
export interface ProofFile extends ContentFile {
  items: ProofItem[];
}

/** content/experience.json — the work timeline. */
export interface ExperienceFile extends ContentFile {
  items: ExperienceItem[];
}

/** content/research.json — the featured research card and its research-note page. */
export interface ResearchFile extends ContentFile, Research {
  /** How each research status is written on badges. */
  statusLabels: Record<ResearchStatus, string>;
  /** Text on the homepage research card. */
  card: {
    /** Headings for the three progress columns. */
    progressLabels: { completed: string; planned: string; pending: string };
    /** Short line under each progress heading. */
    progressSummary: { completed: string; planned: string; pending: string };
    /** Link to the research-note page. */
    linkLabel: string;
    /** Small note under the charts. */
    footnote: string;
    /** Category on its card in the Selected Work grid. */
    gridCategory: string;
    /** Summary on its card in the Selected Work grid. */
    gridSummary: string;
  };
  /** Text on the research-note page. */
  page: {
    /** Small line above the title, e.g. "Independent research". */
    eyebrow: string;
    intro: string;
    headings: { question: string; data: string; evidence: string; method: string; status: string; integrity: string };
    signalsLabel: string;
    evidenceNote: string;
    /** Model names shown as steps. */
    models: string[];
  };
}

/** Where a project card leads. */
export interface CardLink {
  /**
   * "case-study" = this item's detail page; "page" = another page on this site (href, e.g. "/research/x");
   * "link" = a website (href);
   * "file" = a file in /public opened in the in-site viewer (href); "none" = the card is not clickable.
   */
  type: "case-study" | "page" | "link" | "file" | "none";
  /** Text at the bottom of the card, e.g. "Explore Work". */
  label: string;
  /** Needed for "link" (full https:// address) and "file" (path inside /public). */
  href?: string;
}

/** content/projects/NAME.json — one project card (and its case study, if any). */
export interface ProjectFile extends ContentFile, Project {
  /** Position in the grid: 1 = first. */
  order: number;
  /** Where the card leads and what its link says. */
  link: CardLink;
}

/** content/leadership.json */
export interface LeadershipFile extends ContentFile {
  items: LeadershipItem[];
}

/** content/honours.json — honours, certificates and education. */
export interface HonoursFile extends ContentFile {
  /** Main list, most impressive first. */
  honours: Honour[];
  /** Smaller prizes behind "View all honours". */
  archive: Honour[];
  certifications: Certification[];
  education: EducationItem[];
  /** Footnotes under the education table. */
  educationNotes?: string[];
  /** Words used in this section. */
  labels: {
    tabs: { honours: string; certifications: string; education: string };
    archiveShow: string;
    archiveHide: string;
    previous: string;
    next: string;
    /** "{n} of {total}" */
    position: string;
    filters: { all: string; finance: string; analytics: string; professional: string; campus: string };
    emptyFilter: string;
    openCertificate: string;
    certificatePending: string;
    /** Shown on a card whose document is kept private. */
    certificatePrivate: string;
    verify: string;
    download: string;
    fit: string;
    actualSize: string;
    imageError: string;
    tableHeadings: { qualification: string; institute: string; board: string; year: string; score: string };
  };
}

/** content/beyond.json — Beyond the Classroom photos. */
export interface BeyondFile extends ContentFile {
  items: BeyondItem[];
  /** Words used by the stack controls. */
  labels: {
    previous: string;
    next: string;
    /** Screen-reader name of the stack, e.g. "Experiences". */
    stack: string;
  };
}

/** content/resume.json — the downloadable résumé. */
/** One role-specific résumé in the Résumé Library selector. */
export interface ResumeVariant {
  /** Short stable id, e.g. "master", "research". */
  id: string;
  /** Selector label, e.g. "Investment Banking". */
  label: string;
  /** PDF path inside /public (or a media-library /media/… path), or null while the real PDF is not ready. */
  file: string | null;
  /** Name the browser saves the file as, e.g. "Pradosh_Kumar_Lenka_Resume_Research.pdf". */
  downloadName: string;
  /** One line describing this version (leave out until the real PDF exists). */
  description?: string;
}

export interface ResumeFile extends ContentFile, ResumeItem {
  /** One line describing the document. */
  description: string;
  /**
   * Role-specific versions shown as a selector (optional). Leave out to show only the
   * Master Résumé above. Versions whose file is null are listed as "awaiting the PDF".
   */
  variants?: ResumeVariant[];
  /** Words used in the Résumé Library. */
  labels: {
    download: string;
    open: string;
    /** "PDF · {size}" */
    meta: string;
    /** Shown if the PDF file is missing. */
    missing: string;
    /** Selector heading, e.g. "Choose the résumé for your role". */
    choose?: string;
    /** Shown for a version whose PDF is not ready yet. "{role}" is replaced. */
    awaiting?: string;
    /** Button that switches to the Master Résumé from an awaiting version. */
    useMaster?: string;
  };
}

/** content/contact.json */
export interface ContactFile extends ContentFile {
  links: ContactLink[];
  /** City shown under the contact rows (optional). */
  location?: string;
  /** Formal headshot path inside /public. */
  headshot: string;
  /** Describes the headshot for screen readers. */
  headshotAlt: string;
  /** Words used in the Contact section. */
  labels: {
    copy: string;
    copied: string;
    copyFailed: string;
    opensInNewTab: string;
  };
}

/** content/footer.json */
export interface FooterFile extends ContentFile {
  copyright: string;
  signoff: string;
  backToTop: string;
}

/**
 * content/ui.json — small interface words (buttons, headings, messages).
 * Words in {curly braces} are filled in automatically: keep them exactly as they are.
 */
export interface UiFile extends ContentFile {
  navigation: { openMenu: string; closeMenu: string };
  selectedWork: {
    /** Small heading above the project cards. */
    heading: string;
    /** Word after the number of items, e.g. "items". */
    countLabel: string;
    /** The one action shown on every card, e.g. "Explore Work". */
    action: string;
  };
  caseStudy: {
    backLink: string;
    nextLabel: string;
    headings: { context: string; role: string; approach: string; results: string; learned: string };
    positionsLabel: string;
  };
  resources: {
    heading: string;
    preview: string;
    downloadOriginal: string;
    openLink: string;
    opensInNewTab: string;
    verify: string;
    /** Open-button text by file kind (PDF/Word = report, PowerPoint = presentation, Excel = model). */
    actions: { report: string; presentation: string; model: string };
  };
  viewer: {
    close: string;
    loadingPdf: string;
    loadingWorkbook: string;
    loadingDocument: string;
    /** {error} is replaced with the technical reason. */
    pdfError: string;
    workbookError: string;
    documentError: string;
    noPreview: string;
    emptySheet: string;
    workbookNote: string;
    documentNote: string;
    page: string;
    slide: string;
    of: string;
  };
  charts: {
    rateShock: {
      title: string;
      badge: string;
      shiftLabel: string;
      changeLabel: string;
      /** {D} duration, {C} convexity, {bp} anchor shift, {result} calculated change, {documented} documented change. */
      footnote: string;
    };
    beta: { title: string };
    pairedBars: {
      referenceLine: string;
      sourcePrefix: string;
      sourcePending: string;
      /** Shown under the bars until one is hovered, focused or tapped. */
      hint: string;
      /** "{change} vs {other}" */
      versus: string;
      /** "{gap} pp above full collection" / "… below …" */
      aboveFull: string;
      belowFull: string;
      /** "{share}% of {other}" (for ₹ amounts, the smaller value as a share of the larger) */
      shareOf: string;
    };
  };
  placeholders: { imagePending: string; portrait: string; certificate: string };
  notFound: { code: string; title: string; button: string };
}

/* ------------------------------------------------------------------ Design */

/**
 * content/design.json — the theme's colours and corner rounding (dark theme only).
 * Text colours are checked for readability against the page background.
 * The page background itself is the cosmic scene and is not set here.
 */
export interface DesignFile extends ContentFile {
  colors: {
    /**
     * Primary accent: buttons, links, highlights (hex, e.g. "#a56bff").
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    violet: string;
    /**
     * Soft accent: highlighted words, labels (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    lavender: string;
    /**
     * Text placed on accent-coloured buttons (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    onViolet: string;
    /**
     * Main text (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    fg: string;
    /**
     * Secondary text (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    fgMuted: string;
    /**
     * Captions and small print (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    fgSubtle: string;
    /**
     * Cards and menus (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    surface: string;
    /**
     * Hovered cards (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    surface2: string;
    /**
     * Gains and "available" status (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    positive: string;
    /**
     * Losses and stress shading (hex).
     * @pattern ^#[0-9a-fA-F]{6}$
     */
    negative: string;
  };
  radii: {
    /**
     * Inputs and small controls (px).
     * @minimum 0
     * @maximum 24
     */
    control: number;
    /**
     * Cards (px).
     * @minimum 0
     * @maximum 40
     */
    card: number;
    /**
     * Large panels (px).
     * @minimum 0
     * @maximum 48
     */
    panel: number;
  };
}

/* --------------------------------------------------------------- Animation */

/**
 * content/animation.json — motion settings the site reads today.
 * Every number has a safe range; reduced-motion preferences always win.
 */
export type AnimationFile = ContentFile & Omit<AnimationConfig, "documented">;
