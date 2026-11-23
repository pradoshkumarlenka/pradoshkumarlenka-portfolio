# How to edit the website (no coding needed)

Everything you can see on the website — every sentence, number, button, image and
certificate — is written in the files in **this `content` folder**. You never need to
open the code.

Each file controls **one part** of the site. Changing one file (or one line) changes
only that thing; nothing else moves.

---

## The 4 rules (read these once)

A content file looks like this:

```json
{
  "title": "Selected work",
  "countLabel": "projects"
}
```

1. **Only change the words inside the quotes on the right.**
   `"title": "Selected work"` → `"title": "My projects"` ✅
   Never change the word on the left (`"title"`) — that is the field name.
2. **Keep the quotes.** Text always sits between `"` and `"`.
   To use a quote mark inside your text, use curly quotes “like this”.
3. **Keep the commas.** Every line inside `{ }` or `[ ]` ends with a comma,
   except the last one.
4. **Numbers have no quotes:** `"order": 2` (not `"order": "2"`).

**Tip:** open the folder in **VS Code**. It shows hints when you hover over a field,
suggests allowed values as you type, and underlines mistakes in red.

---

## See your change

1. Open a terminal in the project folder and run `npm run dev`
2. Open http://localhost:3000 — the page updates when you save a file.

If you made a mistake, the terminal tells you **which file, where, and what is wrong**,
for example:

```
✖ content/proof.json → "items" → entry #1: "lable" is not a known field here.
  Check the spelling (field names are case-sensitive).
```

Fix it, save, and run `npm run dev` again. You can also check everything at any time
with `npm run check:content`.

---

## Which file controls what

| What you see on the site | File |
| --- | --- |
| Browser tab title, Google description | `site.json` |
| Menu labels, section headings, hide/show/reorder sections | `sections.json` |
| Name, green status label, statement, buttons, portrait photo | `hero.json` |
| The strip of 4 facts under the name | `proof.json` |
| Work experience timeline | `experience.json` |
| Featured research card + its research page | `research.json` |
| One project card + its case-study page | `projects/<name>.json` (one file each) |
| Leadership | `leadership.json` |
| Honours, certificates, education | `honours.json` |
| Beyond the Classroom photos | `beyond.json` |
| Résumé download | `resume.json` |
| Email, phone, LinkedIn, contact photo | `contact.json` |
| Footer | `footer.json` |
| Small words used everywhere (“Preview”, “Download original”, “Back to …”, chart labels, messages) | `ui.json` |

The `schemas` folder is used by the checker — you don't need to open it.

---

## Common changes

### Change any text
Find it in the file from the table above, change the words inside the quotes, save.

### Change a photo (portrait, certificate, event photo)
1. Put the new image in the `public` folder — e.g. `public/photos/new-headshot.webp`
   (`.webp`, `.jpg` or `.png`).
2. In the content file, change the path: `"image": "/photos/new-headshot.webp"`
   (paths start with `/` and leave out the word `public`).
3. **Portrait only:** in `hero.json`, `backdropColor` is the plain background colour of
   the photo (e.g. `"#8b868a"`). Update it to the new photo's background colour so the
   dotted effect leaves the background out.

Until an image exists, the site shows a neat “Image pending” box instead of a broken image.

### Change a project or research picture
Each file in `projects/` (and `research.json`) has:

```json
"image": "/images/portfolio/01-dfi-infrastructure-bonds.png",
"imageAlt": "Short description of the picture",
"imagePosition": "center"
```

- Use a **3:2** picture (e.g. 1200 × 800 px) in `public/images/portfolio/`. Every
  card shows it whole in a 3:2 frame — nothing is cut off or stretched.
- `imagePosition` only matters if you use a picture of a different shape (then part
  of it is trimmed; `"top"`, `"left"`, `"30% 50%"` … choose which part stays).
- `"image": null` removes the picture from that card.
- The editable originals (SVG) are in `public/images/portfolio/source/`.
- These pictures are decoration — real numbers and charts stay in the text and data.

### Beyond the Classroom cards
Each card in `beyond.json` → `"items"` looks like:

```json
{
  "id": "nse-bell",
  "title": "Ringing the NSE bell",
  "category": "Markets",
  "caption": "Rang the bell at NSE during the SSIM visit.",
  "image": "/photos/beyond-classroom/nse-bell.jpg",
  "imageAlt": "What the photo shows, for screen readers",
  "imagePosition": "72% center"
}
```

- **Replace a photo:** put it in `public/photos/beyond-classroom/` and change `"image"`.
  Cards show photos in a tall 4:5 frame; if a face or sign is cut off, change
  `imagePosition` (first number = left ↔ right, second = top ↕ bottom).
- **Add a card:** copy a block, give it a new `id` (unique, lowercase-with-dashes) and real
  details. The counter (“01 / 06”) and controls update automatically. Only add photos of
  experiences that really happened, with a factual caption.
- **Remove a card:** delete its block.

### Add a certificate
1. In `honours.json`, copy one certificate block `{ … }` inside `"certifications"`,
   paste it after a comma, and change `name`, `issuer`, `year`, `date`, `category`
   (`Finance`, `Analytics`, `Professional` or `Campus` — this drives the filter buttons) and
   `verifyUrl` (only a real verify link from the issuer, otherwise `null`).
2. **From a PDF, JPG or PNG (recommended):** put the original in the `certificates-src`
   folder (never published), set `"source": "certificates-src/<file>.pdf"` (or `.jpg`/`.png`
   for a scan or phone photo), `"image": "/certificates/<short-name>.webp"` and
   `"download": "/certificates/originals/<short-name>.pdf"` (`.jpg` for photos), then run
   `npm run certificates`. It makes the picture and the download for you.
3. **Hide private details:** add a `"redact"` list of boxes to blur (signatures,
   certificate numbers, codes, parents' names, dates of birth). Each box is a fraction of
   the page: `{ "label": "Signature", "x": 0.75, "y": 0.66, "w": 0.19, "h": 0.05 }`
   (x/y = top-left corner, 0 = left/top, 1 = right/bottom). With redactions, the download
   must end in `.jpg` (a blurred copy) — the original PDF is never published.
   Re-run `npm run certificates` and check the picture.
4. **From an image instead:** save an already-cleaned image as
   `public/certificates/<short-name>.webp` and leave `source` out.
5. No file yet? Keep `"image": null` — the card shows “Certificate file to be added”.
   A real certificate you don't want to publish (e.g. a letter)? Keep `"image": null` and
   add `"filePrivate": true` — the card shows the title and dates with “Document kept private”.
   To hide a certificate completely, add `"visible": false`.
6. Never add mark sheets or documents with dates of birth, parents' names or ID numbers.

### Change what a project card's link says or where it goes
In `projects/<name>.json`, edit `"link"`:

```json
"link": { "type": "case-study", "label": "View case study" }
```

| `type` | What happens when clicked | Also needs |
| --- | --- | --- |
| `"case-study"` | Opens the project's case-study page | a `"caseStudy"` section in the same file |
| `"link"` | Opens a website in a new tab | `"href": "https://…"` |
| `"file"` | Opens a file inside the site (PDF, Excel, Word) | `"href": "/projects/<name>/file.pdf"` |
| `"none"` | Nothing — the card is just information | — |

`label` is the text at the bottom of the card, e.g. `"Read report"`, `"Open model"`.

### Add a new project
1. Copy any file in `projects/` and rename the copy, e.g. `my-new-project.json`.
2. Change everything inside, especially `"slug"` (lowercase-with-hyphens, used in the
   web address) and `"order"` (1 = first card).
3. No case study? Delete the whole `"caseStudy": { … }` block and set the link
   `type` to `"link"`, `"file"` or `"none"`.
4. Restart `npm run dev` so the new file is picked up.

### Remove a project
Delete its file in `projects/` and restart `npm run dev`.

### Attach files to a project (Excel, PDF, PowerPoint, Word)
1. Put the file in `public/projects/<slug>/`.
2. In the project file, add it to `"resources"` — see the examples in the main
   `README.md` (“Attach project resources”). Visitors get **Preview** and
   **Download original** buttons; the panel only appears when there is at least one file.

### Hide, show or reorder a homepage section
In `sections.json`, set `"visible": false` to hide a section, or change `"order"`.

### Replace the résumé
Overwrite `public/resumes/Pradosh_Kumar_Lenka_Resume_Master.pdf` with the new PDF
(same file name). Nothing else needs to change.

---

## If something goes wrong

- Read the message in the terminal — it names the file and the place.
- Undo your last change (Ctrl + Z in the editor) and save.
- Words in `{curly braces}` inside `ui.json` (like `{error}` or `{bp}`) are filled in
  automatically — keep them exactly as they are.
