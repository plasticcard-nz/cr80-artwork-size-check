// ==UserScript==
// @name         CR80 artwork size check
// @namespace    https://plasticcard.nz/
// @version      1.0.0
// @description  Check whether the image in this tab is large enough to print on a standard CR80 plastic card (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm) at 300 dpi, with or without 3 mm bleed. This is a pixel-size helper only. For a full PDF or image check, use https://plasticcard.nz/tools/card-artwork-checker/
// @author       Allan Hall, PlasticCard.nz
// @license      MIT
// @homepage     https://plasticcard.nz/tools/card-artwork-checker/
// @homepageURL  https://plasticcard.nz/tools/card-artwork-checker/
// @supportURL   https://plasticcard.nz/tools/card-artwork-checker/
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // --- core start ---
  /**
   * CR80 (ISO/IEC 7810 ID-1) size helpers.
   * Pixels at 300 dpi are calculated as round(mm * 300 / 25.4), which is the
   * same rounding published by the PlasticCard.nz artwork checker:
   * finished card 1011 × 638 px; 3 mm bleed on each edge 1082 × 708 px.
   */
  var CR80 = {
    DPI: 300,
    TRIM_MM: { long: 85.6, short: 53.98 },
    BLEED_MM: 3,
    CHECKER_URL: 'https://plasticcard.nz/tools/card-artwork-checker/',
    SITE_URL: 'https://plasticcard.nz/',

    mmToPx: function (mm, dpi) {
      dpi = dpi == null ? 300 : dpi;
      return Math.round((mm * dpi) / 25.4);
    },

    targets: function (dpi) {
      dpi = dpi == null ? 300 : dpi;
      var trimLong = this.mmToPx(this.TRIM_MM.long, dpi);
      var trimShort = this.mmToPx(this.TRIM_MM.short, dpi);
      var bleedExtra = this.BLEED_MM * 2;
      return {
        dpi: dpi,
        trim: { long: trimLong, short: trimShort },
        bleed: {
          long: this.mmToPx(this.TRIM_MM.long + bleedExtra, dpi),
          short: this.mmToPx(this.TRIM_MM.short + bleedExtra, dpi),
        },
      };
    },

    /**
     * Compare an image's pixel size with CR80 trim and 3 mm bleed at 300 dpi.
     * Orientation does not matter: the long side is compared with the long side.
     */
    evaluate: function (width, height, dpi) {
      var w = Number(width);
      var h = Number(height);
      if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) {
        return { ok: false, error: 'The image size could not be read.' };
      }
      w = Math.round(w);
      h = Math.round(h);
      var longSide = Math.max(w, h);
      var shortSide = Math.min(w, h);
      var t = this.targets(dpi);
      var inchesLong = this.TRIM_MM.long / 25.4;
      var inchesShort = this.TRIM_MM.short / 25.4;
      var ppiLong = longSide / inchesLong;
      var ppiShort = shortSide / inchesShort;
      var ppiAtTrim = Math.min(ppiLong, ppiShort);
      var meetsTrim = longSide >= t.trim.long && shortSide >= t.trim.short;
      var meetsBleed = longSide >= t.bleed.long && shortSide >= t.bleed.short;
      var limiting =
        ppiLong <= ppiShort
          ? 'long side (' + longSide + ' px across ' + this.TRIM_MM.long.toFixed(2) + ' mm)'
          : 'short side (' + shortSide + ' px across ' + this.TRIM_MM.short.toFixed(2) + ' mm)';

      var verdict;
      if (meetsBleed) {
        verdict =
          'Large enough for a CR80 card with 3 mm bleed at ' + t.dpi + ' dpi.';
      } else if (meetsTrim) {
        verdict =
          'Large enough for a trim-only CR80 card at ' +
          t.dpi +
          ' dpi, but short of the 3 mm bleed target (' +
          t.bleed.long +
          ' × ' +
          t.bleed.short +
          ' px).';
      } else {
        verdict =
          'Below ' +
          t.dpi +
          ' dpi at CR80 trim size (about ' +
          Math.round(ppiAtTrim) +
          ' ppi on the limiting side).';
      }

      return {
        ok: true,
        width: w,
        height: h,
        longSide: longSide,
        shortSide: shortSide,
        orientation: w >= h ? 'landscape' : 'portrait',
        targets: t,
        meetsTrim: meetsTrim,
        meetsBleed: meetsBleed,
        ppiAtTrim: ppiAtTrim,
        limiting: limiting,
        verdict: verdict,
      };
    },
  };
  // --- core end ---

  var OVERLAY_ID = 'cr80-artwork-size-check-overlay';
  var STYLE_ID = 'cr80-artwork-size-check-style';

  function isRawImageTab() {
    var type = document.contentType || '';
    if (/^image\//i.test(type)) return true;
    var path = (location.pathname || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|tif|tiff|avif|svg)(\?|#|$)/i.test(location.href) ||
        /\.(png|jpe?g|gif|webp|bmp|tif|tiff|avif|svg)$/i.test(path)) {
      var imgs = document.images;
      if (imgs && imgs.length === 1) {
        var src = imgs[0].currentSrc || imgs[0].src || '';
        if (src && (src === location.href || src.split('?')[0] === location.href.split('?')[0])) {
          return true;
        }
      }
    }
    return false;
  }

  function isWikimediaFilePage() {
    var host = location.hostname;
    if (!/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(host)) return false;
    return /\/wiki\/File:/i.test(location.pathname) || /title=File:/i.test(location.search);
  }

  function wikiFileImage() {
    return (
      document.querySelector('#file img') ||
      document.querySelector('.fullImageLink img') ||
      document.querySelector('.mw-filepage-image img') ||
      document.querySelector('img.mw-file-element')
    );
  }

  function areaOf(img) {
    var w = img.naturalWidth || 0;
    var h = img.naturalHeight || 0;
    return w * h;
  }

  function isIgnoredImage(img) {
    if (!img || img.tagName !== 'IMG') return true;
    if (img.closest('#' + OVERLAY_ID)) return true;
    var w = img.naturalWidth || 0;
    var h = img.naturalHeight || 0;
    if (w > 0 && h > 0 && (w < 64 || h < 64)) return true;
    var role = (img.getAttribute('role') || '').toLowerCase();
    if (role === 'presentation' || role === 'none') return true;
    var alt = (img.getAttribute('alt') || '').toLowerCase();
    if (img.closest('header, nav, footer, [role="banner"], [role="navigation"]') && w * h < 150 * 150) {
      return true;
    }
    if (/avatar|sprite|emoji|icon|logo|pixel|tracking|spacer|badge/.test(alt) && w * h < 200 * 200) {
      return true;
    }
    return false;
  }

  function largestContentImage() {
    var images = document.images ? Array.prototype.slice.call(document.images) : [];
    var best = null;
    var bestArea = 0;
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (isIgnoredImage(img)) continue;
      var area = areaOf(img);
      if (area > bestArea) {
        best = img;
        bestArea = area;
      }
    }
    return best;
  }

  function findPrimaryImage() {
    if (isRawImageTab() && document.images && document.images[0]) {
      return document.images[0];
    }
    if (isWikimediaFilePage()) {
      var wiki = wikiFileImage();
      if (wiki) return wiki;
    }
    var main = document.querySelector('main img, article img, [role="main"] img, #content img');
    var largest = largestContentImage();
    if (main && !isIgnoredImage(main) && largest) {
      // Prefer the largest image overall; a small inline image in <main> should not win.
      if (areaOf(main) >= areaOf(largest) * 0.5) return areaOf(main) >= areaOf(largest) ? main : largest;
    }
    return largest || main || null;
  }

  function waitForDimensions(img, timeoutMs) {
    return new Promise(function (resolve, reject) {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve(img);
        else reject(new Error('The image has not finished loading.'));
      }, timeoutMs || 4000);
      function ok() {
        if (done) return;
        if (!(img.naturalWidth > 0 && img.naturalHeight > 0)) return;
        done = true;
        cleanup();
        resolve(img);
      }
      function fail() {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error('The image failed to load.'));
      }
      function cleanup() {
        clearTimeout(timer);
        img.removeEventListener('load', ok);
        img.removeEventListener('error', fail);
      }
      img.addEventListener('load', ok);
      img.addEventListener('error', fail);
    });
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + OVERLAY_ID + '{',
      '  all: initial;',
      '  position: fixed;',
      '  z-index: 2147483646;',
      '  right: 16px;',
      '  bottom: 16px;',
      '  max-width: min(28rem, calc(100vw - 32px));',
      '  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
      '  font-size: 14px;',
      '  line-height: 1.45;',
      '  color: #12202b;',
      '  background: #fff;',
      '  border: 1px solid #c5d0d6;',
      '  border-radius: 8px;',
      '  box-shadow: 0 8px 28px rgba(18,32,43,0.22);',
      '  padding: 14px 16px 16px;',
      '  box-sizing: border-box;',
      '}',
      '#' + OVERLAY_ID + ' *{ box-sizing: border-box; font-family: inherit; }',
      '#' + OVERLAY_ID + ' h1{ font-size: 16px; font-weight: 650; margin: 0 28px 8px 0; color: #12202b; }',
      '#' + OVERLAY_ID + ' p{ margin: 0 0 8px; }',
      '#' + OVERLAY_ID + ' p:last-child{ margin-bottom: 0; }',
      '#' + OVERLAY_ID + ' .cr80-verdict{ font-weight: 650; margin-bottom: 10px; }',
      '#' + OVERLAY_ID + ' .cr80-ok{ color: #0b5f2a; }',
      '#' + OVERLAY_ID + ' .cr80-mid{ color: #7a4b00; }',
      '#' + OVERLAY_ID + ' .cr80-no{ color: #8a1f1f; }',
      '#' + OVERLAY_ID + ' dl{ margin: 0 0 10px; display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; }',
      '#' + OVERLAY_ID + ' dt{ color: #4a5a64; margin: 0; }',
      '#' + OVERLAY_ID + ' dd{ margin: 0; font-variant-numeric: tabular-nums; }',
      '#' + OVERLAY_ID + ' a{ color: #0b4f8a; text-decoration: underline; }',
      '#' + OVERLAY_ID + ' .cr80-note, #' + OVERLAY_ID + ' .cr80-credit{ color: #4a5a64; font-size: 12.5px; }',
      '#' + OVERLAY_ID + ' button.cr80-close{',
      '  all: unset;',
      '  position: absolute;',
      '  top: 8px;',
      '  right: 8px;',
      '  width: 28px;',
      '  height: 28px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  cursor: pointer;',
      '  color: #4a5a64;',
      '  border-radius: 4px;',
      '  font-size: 20px;',
      '  line-height: 1;',
      '}',
      '#' + OVERLAY_ID + ' button.cr80-close:hover, #' + OVERLAY_ID + ' button.cr80-close:focus{',
      '  background: #eef3f6;',
      '  color: #12202b;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function closeOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
    document.removeEventListener('keydown', onEscape, true);
  }

  function onEscape(event) {
    if (event.key === 'Escape') closeOverlay();
  }

  function resultClass(result) {
    if (!result || !result.ok) return '';
    if (result.meetsBleed) return 'cr80-ok';
    if (result.meetsTrim) return 'cr80-mid';
    return 'cr80-no';
  }

  function showMessage(title, bodyNodes) {
    ensureStyles();
    closeOverlay();
    var root = document.createElement('section');
    root.id = OVERLAY_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', title);
    var close = document.createElement('button');
    close.className = 'cr80-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', closeOverlay);
    var heading = document.createElement('h1');
    heading.textContent = title;
    root.appendChild(close);
    root.appendChild(heading);
    bodyNodes.forEach(function (node) {
      root.appendChild(node);
    });
    (document.body || document.documentElement).appendChild(root);
    document.addEventListener('keydown', onEscape, true);
    close.focus();
  }

  function p(className, text) {
    var el = document.createElement('p');
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function checkerLink(label) {
    var a = document.createElement('a');
    a.href = CR80.CHECKER_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label || CR80.CHECKER_URL;
    return a;
  }

  function creditLine() {
    var el = document.createElement('p');
    el.className = 'cr80-credit';
    el.appendChild(
      document.createTextNode(
        'Pixel-size helper for CR80 print files. For bleed, safe margin and a visual check of a PDF or image, use the free artwork checker at '
      )
    );
    el.appendChild(checkerLink('plasticcard.nz/tools/card-artwork-checker'));
    el.appendChild(document.createTextNode('.'));
    return el;
  }

  function showNoImage(reason) {
    var intro = p(
      '',
      reason || 'No image on this page could be measured.'
    );
    var offer = document.createElement('p');
    offer.appendChild(
      document.createTextNode(
        'If you have a PDF or an image file, you can check it with the free CR80 artwork checker (PDF and images): '
      )
    );
    offer.appendChild(checkerLink(CR80.CHECKER_URL));
    offer.appendChild(document.createTextNode('.'));
    showMessage('CR80 artwork size check', [intro, offer]);
  }

  function showResult(result, sourceLabel) {
    var t = result.targets;
    var verdict = p('cr80-verdict ' + resultClass(result), result.verdict);

    var dl = document.createElement('dl');
    function row(term, value) {
      var dt = document.createElement('dt');
      dt.textContent = term;
      var dd = document.createElement('dd');
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    row('Detected size', result.width + ' × ' + result.height + ' px (' + result.orientation + ')');
    if (sourceLabel) row('Image', sourceLabel);
    row(
      'CR80 trim at ' + t.dpi + ' dpi',
      t.trim.long +
        ' × ' +
        t.trim.short +
        ' px  ·  ' +
        (result.meetsTrim ? 'meets target' : 'below target')
    );
    row(
      'With 3 mm bleed',
      t.bleed.long +
        ' × ' +
        t.bleed.short +
        ' px  ·  ' +
        (result.meetsBleed ? 'meets target' : 'below target')
    );
    row(
      'Effective ppi at trim',
      Math.round(result.ppiAtTrim) + ' ppi on the limiting ' + result.limiting
    );

    var note = p(
      'cr80-note',
      'This is a pixel-size check only. It is not a preview of bleed, fonts or colour, and it does not inspect the file itself.'
    );
    var linkLine = document.createElement('p');
    linkLine.appendChild(document.createTextNode('Free CR80 artwork checker (PDF and images): '));
    linkLine.appendChild(checkerLink(CR80.CHECKER_URL));

    showMessage('CR80 artwork size check', [verdict, dl, note, linkLine, creditLine()]);
  }

  function imageLabel(img) {
    var src = img.currentSrc || img.src || '';
    if (!src) return '';
    try {
      var u = new URL(src, location.href);
      var name = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
      return decodeURIComponent(name);
    } catch (e) {
      return src.slice(0, 80);
    }
  }

  function runCheck() {
    var img = findPrimaryImage();
    if (!img) {
      showNoImage('No image on this page could be measured.');
      return;
    }
    waitForDimensions(img, 5000)
      .then(function (ready) {
        var result = CR80.evaluate(ready.naturalWidth, ready.naturalHeight, 300);
        if (!result.ok) {
          showNoImage(result.error);
          return;
        }
        showResult(result, imageLabel(ready));
      })
      .catch(function (err) {
        showNoImage(err && err.message ? err.message : 'The image size could not be read.');
      });
  }

  function shouldAutoRun() {
    return isRawImageTab() || isWikimediaFilePage();
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Check this image for CR80 print size', runCheck);
  }

  if (shouldAutoRun()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runCheck, { once: true });
    } else {
      runCheck();
    }
  }

  // Expose core helpers for the Node test file when this script is evaluated outside a browser.
  if (typeof module === 'object' && module.exports) {
    module.exports = CR80;
  }
})();
