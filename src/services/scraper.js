import axios from 'axios';
import * as cheerio from 'cheerio';

// Domaine actuel — à changer quand le DNS change
const BASE_URL = 'https://flemmix.info';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  },
});

/**
 * Fetch et parse la page d'accueil pour extraire le catalogue.
 * Retourne un tableau de { id, title, thumbnail, pageUrl }
 *
 * NOTE: Les sélecteurs CSS ci-dessous sont des patterns courants.
 * À ajuster après inspection du HTML réel du site.
 */
export async function fetchCatalog() {
  try {
    const { data: html } = await client.get('/');
    const $ = cheerio.load(html);
    const items = [];

    // Pattern 1: articles ou divs avec classe contenant "post", "movie", "item", "card"
    const selectors = [
      'article',
      '.post',
      '.movie',
      '.item',
      '.card',
      '.film',
      '.entry',
      '.video-item',
      '.content-item',
      '[class*="movie"]',
      '[class*="film"]',
      '[class*="video"]',
    ];

    const selector = selectors.join(', ');
    const elements = $(selector);

    if (elements.length === 0) {
      // Fallback: chercher tous les liens avec images
      $('a').each((i, el) => {
        const $el = $(el);
        const $img = $el.find('img').first();
        if (!$img.length) return;

        const href = $el.attr('href');
        const title =
          $img.attr('alt') ||
          $el.attr('title') ||
          $el.text().trim() ||
          `Video ${i + 1}`;
        const thumbnail =
          $img.attr('src') ||
          $img.attr('data-src') ||
          $img.attr('data-lazy-src') ||
          '';

        if (href && thumbnail && !href.includes('#')) {
          items.push({
            id: `item-${i}`,
            title: cleanTitle(title),
            thumbnail: resolveUrl(thumbnail),
            pageUrl: resolveUrl(href),
          });
        }
      });
    } else {
      elements.each((i, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const $img = $el.find('img').first();

        const href = $link.attr('href') || $el.find('a[href]').attr('href');
        const title =
          $el.find('h2, h3, h4, .title, [class*="title"]').first().text().trim() ||
          $img.attr('alt') ||
          $link.attr('title') ||
          `Video ${i + 1}`;
        const thumbnail =
          $img.attr('src') ||
          $img.attr('data-src') ||
          $img.attr('data-lazy-src') ||
          '';

        if (href) {
          items.push({
            id: `item-${i}`,
            title: cleanTitle(title),
            thumbnail: resolveUrl(thumbnail),
            pageUrl: resolveUrl(href),
          });
        }
      });
    }

    // Dédupliquer par pageUrl
    const seen = new Set();
    return items.filter((item) => {
      if (seen.has(item.pageUrl)) return false;
      seen.add(item.pageUrl);
      return true;
    });
  } catch (error) {
    console.error('Scraper fetchCatalog error:', error.message);
    throw error;
  }
}

/**
 * Fetch une page de détail pour trouver l'URL du stream vidéo.
 * Retourne { streamUrl, title, thumbnail } ou null.
 */
export async function fetchStreamUrl(pageUrl) {
  try {
    const { data: html } = await client.get(pageUrl);
    const $ = cheerio.load(html);

    // Chercher un lecteur vidéo ou iframe
    let streamUrl = null;

    // 1. Balise <video> directe
    const videoSrc =
      $('video source').attr('src') || $('video').attr('src');
    if (videoSrc) {
      streamUrl = resolveUrl(videoSrc);
    }

    // 2. Iframe (lecteur embarqué)
    if (!streamUrl) {
      const iframeSrc = $('iframe').filter((_, el) => {
        const src = $(el).attr('src') || '';
        return (
          src.includes('embed') ||
          src.includes('player') ||
          src.includes('video')
        );
      }).first().attr('src');
      if (iframeSrc) {
        streamUrl = resolveUrl(iframeSrc);
        // Si c'est un iframe, il faut peut-être aller chercher la vraie URL dedans
        const innerStream = await extractFromEmbed(streamUrl);
        if (innerStream) streamUrl = innerStream;
      }
    }

    // 3. Chercher dans les scripts (URL .m3u8 ou .mp4)
    if (!streamUrl) {
      $('script').each((_, el) => {
        if (streamUrl) return;
        const scriptContent = $(el).html() || '';
        const m3u8Match = scriptContent.match(
          /['"]((https?:)?\/\/[^'"]*\.m3u8[^'"]*)['"]/
        );
        if (m3u8Match) {
          streamUrl = m3u8Match[1].startsWith('//')
            ? 'https:' + m3u8Match[1]
            : m3u8Match[1];
          return;
        }
        const mp4Match = scriptContent.match(
          /['"]((https?:)?\/\/[^'"]*\.mp4[^'"]*)['"]/
        );
        if (mp4Match) {
          streamUrl = mp4Match[1].startsWith('//')
            ? 'https:' + mp4Match[1]
            : mp4Match[1];
        }
      });
    }

    // 4. Lien direct vers .mp4 ou .m3u8
    if (!streamUrl) {
      const directLink = $('a[href*=".mp4"], a[href*=".m3u8"]').first().attr('href');
      if (directLink) {
        streamUrl = resolveUrl(directLink);
      }
    }

    return streamUrl;
  } catch (error) {
    console.error('Scraper fetchStreamUrl error:', error.message);
    return null;
  }
}

/**
 * Essaie d'extraire l'URL de stream depuis un embed/iframe.
 */
async function extractFromEmbed(embedUrl) {
  try {
    const { data: html } = await client.get(embedUrl);
    const $ = cheerio.load(html);

    // Chercher video source
    const videoSrc = $('video source').attr('src') || $('video').attr('src');
    if (videoSrc) return resolveUrl(videoSrc);

    // Chercher dans les scripts
    const scripts = $('script')
      .map((_, el) => $(el).html())
      .get()
      .join('\n');

    const m3u8 = scripts.match(/['"]((https?:)?\/\/[^'"]*\.m3u8[^'"]*)['"]/);
    if (m3u8) return m3u8[1].startsWith('//') ? 'https:' + m3u8[1] : m3u8[1];

    const mp4 = scripts.match(/['"]((https?:)?\/\/[^'"]*\.mp4[^'"]*)['"]/);
    if (mp4) return mp4[1].startsWith('//') ? 'https:' + mp4[1] : mp4[1];

    return null;
  } catch {
    return null;
  }
}

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE_URL + url;
  if (url.startsWith('http')) return url;
  return BASE_URL + '/' + url;
}

function cleanTitle(title) {
  return title.replace(/\s+/g, ' ').trim().substring(0, 120);
}

export { BASE_URL };
