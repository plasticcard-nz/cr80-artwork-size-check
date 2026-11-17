# CR80 artwork size check

A browser userscript that checks whether the image you are looking at has enough pixels to print on a standard CR80 plastic card at 300 dpi.

CR80 is the ISO/IEC 7810 ID-1 size used for most bank, ID, membership and gift cards: 85.60 × 53.98 mm. The script compares the image's pixel width and height with that size, with and without 3 mm bleed. Landscape and portrait are both accepted; the long side is compared with the long side.

This is a pixel-size helper only. It does not preview bleed, fonts or colour, and it does not send the image anywhere. For a visual check of a PDF or image file, including bleed and safe margin guides, use the free [CR80 artwork checker](https://plasticcard.nz/tools/card-artwork-checker/) from [PlasticCard.nz](https://plasticcard.nz/).

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open `cr80-artwork-size-check.user.js` (or the raw file on the repository) and accept the install prompt.
3. On Greasy Fork, use the Install button on the script page once it is listed.

## How to use it

- On a tab that is itself a PNG, JPEG, WebP or other raster image, the check runs on its own and shows a small overlay.
- On a Wikimedia Commons or Wikipedia file page, it measures the main file image automatically.
- On any other page, open the userscript manager menu and choose **Check this image for CR80 print size**. The script measures the largest suitable image on the page.

The overlay reports:

- the detected pixel size
- whether the image meets the 300 dpi trim-only target
- whether it also meets the target with 3 mm bleed
- the effective ppi if the image were printed at CR80 trim size
- a link to the [free CR80 artwork checker](https://plasticcard.nz/tools/card-artwork-checker/) for PDFs and a visual layout check

If no image can be measured, the overlay says so and still points you to the web checker, which accepts PDFs.

Close the overlay with the × button or Escape.

## Pixel targets

Pixels are calculated as `round(mm × 300 / 25.4)`, which is the rounding used by the PlasticCard.nz artwork checker.

| Layout | Millimetres | Pixels at 300 dpi |
| --- | --- | --- |
| CR80 trim (ISO/IEC 7810 ID-1) | 85.60 × 53.98 | 1011 × 638 |
| Same size plus 3 mm bleed on each edge | 91.60 × 59.98 | 1082 × 708 |

An image meets a target when both sides are at least those pixel counts, after swapping sides so that portrait and landscape are treated the same. If either side is short, the overlay says the image is below 300 dpi at CR80 trim size and gives the effective ppi on the limiting side.

The script does not look at colour mode, fonts, crop marks, or whether the file already includes bleed. Use the [artwork checker](https://plasticcard.nz/tools/card-artwork-checker/) for that.

## Permissions

The script asks for `GM_registerMenuCommand` so it can add the menu item. It does not request network access, does not call any server, and does not collect or store personal data. It only reads the width and height of an image already shown in the tab and draws an overlay in that tab.

## Licence

MIT. See [LICENSE](LICENSE).

Author: Allan Hall, [PlasticCard.nz](https://plasticcard.nz/).
