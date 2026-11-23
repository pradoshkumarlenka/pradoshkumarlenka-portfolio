PRADOSH PORTFOLIO — VISUAL ASSET PACK
=====================================

Contents
- png-ready/: six ready-to-use images, all exactly 1200 × 800 px (3:2).
- svg-editable/: matching editable vector originals. Open an SVG in VS Code, Figma, Inkscape, or a browser. Text, colors, shapes and gradients can be edited directly.

Visual style
Dark navy / black, restrained violet light, cool glass-like panels, and muted gold accents. Designed to sit inside the existing cinematic finance/research portfolio.

Images
01-dfi-infrastructure-bonds.png — infrastructure / fixed income
02-ntpc-grasim-valuation.png — industrial valuation
03-nifty-it-risk-return.png — equity market analysis
04-crisis-paper-trading.png — market stress / trading
05-jio-platforms-review.png — telecom / strategy review
06-securitization-xray-research.png — featured research

Recommended placement
- Use 06 as the featured research visual or chart backdrop.
- Use 01–05 as the five selected-work card images in order.
- Keep all cards in a shared aspect-ratio frame: aspect-ratio: 3 / 2; width: 100%; height: 100%; object-fit: cover; object-position: center.
- Do not give each card a different fixed height. Keep one shared CSS class and one shared ratio.
- These illustrations are decorative and do not claim to be real financial charts or verified data. Keep actual metrics/charts in the HTML/CSS/data layer, not baked into these images.

Beginner-friendly editing
1. To change a color, open the SVG and replace the hex value in the relevant gradient or stroke.
2. To change a card image, replace the PNG with another image of the same 3:2 ratio and keep the filename.
3. Keep the same dimensions for all card art to preserve a consistent grid.
4. Do not stretch images. Use object-fit: cover in a fixed 3:2 container; use object-position to reposition the focal point.
5. Keep original SVGs as source files; use PNGs in the website for simple reliable rendering.

Suggested project path
public/images/portfolio/
Copy the contents of png-ready/ into this folder. Optionally copy svg-editable/ into public/images/portfolio/source/ or keep it outside public if source-only assets should not be served.
