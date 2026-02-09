import axios from 'axios';
import * as cheerio from 'cheerio';

// Domaine actuel — changer ici quand le DNS change
let BASE_URL = 'https://flemmix.info';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const client = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: BASE_URL,
  },
});

/**
 * Permet de changer le domaine à la volée.
 */
export function setBaseUrl(url) {
  BASE_URL = url.replace(/\/+$/, '');
  client.defaults.headers.Referer = BASE_URL;
}

export function getBaseUrl() {
  return BASE_URL;
}

// ─────────────────────────────────────────────
// NIVEAU 1 : Catalogue (page d'accueil)
// ─────────────────────────────────────────────

/**
 * Fetch la page d'accueil et extrait le catalogue.
 * Retourne [{ id, title, thumbnail, pageUrl, season, episode, language, synopsis }]
 *
 * Deux sources sur Flemmix :
 * 1. Carousel : .owl-carousel.caroustyle .item (films vedettes)
 * 2. Grille : #dle-content .mov (séries/films avec métadonnées)
 */
export async function fetchCatalog() {
  try {
    const { data: html } = await client.get(BASE_URL);
    const $ = cheerio.load(html);
    const items = [];

    // ── Grille principale : div.mov dans #dle-content ──
    $('#dle-content .mov').each((i, el) => {
      const $mov = $(el);

      // URL de la page détail
      const pageUrl =
        $mov.find('a.mov-t').attr('href') ||
        $mov.find('.mov-mask.ps-link').attr('data-link') ||
        '';
      if (!pageUrl) return;

      // Titre
      const title = $mov.find('a.mov-t').text().trim();

      // Thumbnail (via /checkimg.php?urli=...)
      const thumbnail = $mov.find('.mov-i img').attr('src') || '';

      // Métadonnées
      const season = $mov.find('.block-sai').text().trim().replace(/\s+/g, ' ');
      const episode = $mov.find('.block-ep').text().trim();
      const episodeBadge = $mov.find('.mov-m').text().trim();
      const language = season.includes('VOSTFR') ? 'VOSTFR' : 'VF';

      // Synopsis depuis movie-text
      const synopsis = $mov.find('.ml-label').filter((_, el) =>
        $(el).text().includes('Synopsis')
      ).next('.ml-desc').text().trim();

      // Année
      const year = $mov.find('.ml-label').filter((_, el) =>
        $(el).text().includes('Date de sortie')
      ).next('.ml-desc').text().trim();

      items.push({
        id: `mov-${i}`,
        title: cleanText(title),
        thumbnail: resolveUrl(thumbnail),
        pageUrl: resolveUrl(pageUrl),
        season: cleanText(season),
        episode: cleanText(episode || episodeBadge),
        language,
        year: year || null,
        synopsis: cleanText(synopsis),
      });
    });

    // ── Carousel : films vedettes (si pas déjà dans la grille) ──
    $('.owl-carousel.caroustyle .item').each((i, el) => {
      const $item = $(el);
      const $link = $item.find('a').first();
      const pageUrl = $link.attr('href') || '';
      if (!pageUrl) return;

      const title = $item.find('.title1').text().trim();
      const thumbnail = $item.find('img').attr('src') || '';

      items.push({
        id: `car-${i}`,
        title: cleanText(title),
        thumbnail: resolveUrl(thumbnail),
        pageUrl: resolveUrl(pageUrl),
        season: null,
        episode: null,
        language: 'VF',
        year: null,
        synopsis: null,
      });
    });

    return dedup(items);
  } catch (error) {
    console.error('fetchCatalog error:', error.message);
    throw error;
  }
}

/**
 * Fetch une page de catalogue paginée.
 * Ex: fetchCatalogPage(2) → /serie-en-streaming/page/2/
 */
export async function fetchCatalogPage(page, category = 'serie-en-streaming') {
  try {
    const url = `${BASE_URL}/${category}/page/${page}/`;
    const { data: html } = await client.get(url);
    const $ = cheerio.load(html);
    const items = [];

    $('#dle-content .mov').each((i, el) => {
      const $mov = $(el);
      const pageUrl = $mov.find('a.mov-t').attr('href') || '';
      if (!pageUrl) return;

      const title = $mov.find('a.mov-t').text().trim();
      const thumbnail = $mov.find('.mov-i img').attr('src') || '';
      const season = $mov.find('.block-sai').text().trim().replace(/\s+/g, ' ');
      const episode = $mov.find('.block-ep').text().trim();
      const language = season.includes('VOSTFR') ? 'VOSTFR' : 'VF';

      items.push({
        id: `p${page}-${i}`,
        title: cleanText(title),
        thumbnail: resolveUrl(thumbnail),
        pageUrl: resolveUrl(pageUrl),
        season: cleanText(season),
        episode: cleanText(episode),
        language,
        year: null,
        synopsis: null,
      });
    });

    return dedup(items);
  } catch (error) {
    console.error('fetchCatalogPage error:', error.message);
    return [];
  }
}

/**
 * Fetch la page films (/film-en-streaming/).
 * Retourne la même structure que fetchCatalog mais pour les films.
 */
export async function fetchFilms() {
  return fetchCatalogPage(1, 'film-en-streaming');
}

/**
 * Fetch la page séries (/serie-en-streaming/).
 */
export async function fetchSeries() {
  return fetchCatalogPage(1, 'serie-en-streaming');
}

// ─────────────────────────────────────────────
// NIVEAU 2 : Page détail (épisodes d'une série)
// ─────────────────────────────────────────────

/**
 * Fetch une page de détail (ex: /serie-en-streaming/35041-spartacus-...).
 * Retourne { title, description, episodes: [{ id, episodeNum, title, players: [{ name, url }] }] }
 *
 * Pour un film, retourne { ..., episodes: [{ id: 'film', players: [...] }] }
 */
export async function fetchDetail(pageUrl) {
  try {
    const { data: html } = await client.get(pageUrl);
    const $ = cheerio.load(html);

    const title =
      $('h1').first().text().trim() ||
      $('title').text().trim() ||
      '';

    const description =
      $('.full-text, .fdesc, .description, .story, [class*="desc"]').first().text().trim() ||
      $('meta[name="description"]').attr('content') ||
      '';

    const poster =
      $('.full-poster img, .fimg img, .poster img, .movie-img img').first().attr('src') ||
      '';

    // ── Chercher les épisodes ──
    const episodes = [];

    // Pattern Flemmix : div.hostsblock contient div.ep{N}vs pour chaque épisode
    // Chaque épisode contient des <a onclick="loadVideo('URL')"><span class="clichost">Lecteur X</span></a>
    const hostsblock = $('.hostsblock');
    if (hostsblock.length > 0) {
      hostsblock.find('div[class^="ep"]').each((_, el) => {
        const $ep = $(el);
        const className = $ep.attr('class') || '';

        // Extraire le numéro d'épisode depuis la classe (ep1vs → 1, ep10vs → 10)
        const epMatch = className.match(/^ep(\d+)vs$/);
        if (!epMatch) return;

        const epNum = parseInt(epMatch[1], 10);
        if (epNum === 0) return; // ep00vs est toujours vide

        const players = extractPlayersFromFlemmix($, $ep);
        if (players.length === 0) return; // Épisodes futurs vides

        episodes.push({
          id: `ep-${epNum}`,
          episodeNum: epNum,
          title: `Episode ${epNum}`,
          players,
        });
      });
    }

    // Fallback: pattern générique (autres CMS)
    if (episodes.length === 0) {
      const genericSelectors = [
        '.spoiler', '.episode', '.ep-item',
        '[id^="episode"]', '[id^="ep"]',
        'div[id^="tab"]', '.tab-content > div',
      ];

      let epElements = $([]);
      for (const sel of genericSelectors) {
        epElements = $(sel);
        if (epElements.length > 0) break;
      }

      if (epElements.length > 0) {
        epElements.each((i, el) => {
          const $ep = $(el);
          const epTitle =
            $ep.find('.spoiler-title, .ep-title, b, strong').first().text().trim() ||
            $ep.attr('title') ||
            `Episode ${i + 1}`;

          const players = extractPlayers($, $ep);
          if (players.length > 0) {
            episodes.push({
              id: `ep-${i}`,
              episodeNum: i + 1,
              title: cleanText(epTitle),
              players,
            });
          }
        });
      }
    }

    // Fallback final : pas d'épisodes — c'est un film
    if (episodes.length === 0) {
      const players = extractPlayers($, $.root());
      episodes.push({
        id: 'film',
        episodeNum: 1,
        title: title || 'Lecture',
        players,
      });
    }

    return {
      title: cleanText(title),
      description: cleanText(description),
      poster: resolveUrl(poster),
      episodes,
    };
  } catch (error) {
    console.error('fetchDetail error:', error.message);
    throw error;
  }
}

/**
 * Extrait les lecteurs depuis le format Flemmix.
 * Pattern: <a onclick="loadVideo('URL')"><span class="clichost">Lecteur X</span></a>
 */
function extractPlayersFromFlemmix($, $ep) {
  const players = [];

  $ep.find('a').each((i, el) => {
    const $a = $(el);
    const onclick = $a.attr('onclick') || '';

    // Extraire l'URL depuis loadVideo('...')
    const match = onclick.match(/loadVideo\s*\(\s*'([^']+)'\s*\)/);
    if (!match) return;

    const url = match[1];
    const name = $a.find('.clichost').text().trim() || $a.text().trim() || guessPlayerName(url, i);

    players.push({ name, url });
  });

  return players;
}

/**
 * Extrait tous les lecteurs vidéo d'un élément donné (fallback générique).
 * Retourne [{ name, url }]
 */
function extractPlayers($, $context) {
  const players = [];

  // Iframes (lecteurs embarqués)
  $context.find('iframe[src], iframe[data-src]').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src && !src.includes('about:blank')) {
      const name = guessPlayerName(src, i);
      players.push({ name, url: resolveUrl(src) });
    }
  });

  // Balises <video>
  $context.find('video source[src], video[src]').each((i, el) => {
    const src = $(el).attr('src') || '';
    if (src) {
      players.push({ name: `Lecteur ${i + 1}`, url: resolveUrl(src) });
    }
  });

  // Liens vers des players (onclick, data-url, etc.)
  $context.find('[data-url], [data-src], [data-player]').each((i, el) => {
    const url = $(el).attr('data-url') || $(el).attr('data-src') || $(el).attr('data-player') || '';
    if (url && !players.some((p) => p.url === resolveUrl(url))) {
      const name = $(el).text().trim() || guessPlayerName(url, i);
      players.push({ name: cleanText(name), url: resolveUrl(url) });
    }
  });

  // URLs dans les scripts inline (.m3u8, .mp4)
  $context.find('script').each((_, el) => {
    const script = $(el).html() || '';

    // Chercher les URLs de lecteurs dans les variables JS
    const iframeMatches = script.matchAll(/['"]((https?:)?\/\/[^'"]*(?:embed|player|stream)[^'"]*)['"]/g);
    for (const m of iframeMatches) {
      const url = m[1].startsWith('//') ? 'https:' + m[1] : m[1];
      if (!players.some((p) => p.url === url)) {
        players.push({ name: guessPlayerName(url, players.length), url });
      }
    }

    // Fichiers directs
    const directMatches = script.matchAll(/['"]((https?:)?\/\/[^'"]*\.(?:m3u8|mp4)[^'"]*)['"]/g);
    for (const m of directMatches) {
      const url = m[1].startsWith('//') ? 'https:' + m[1] : m[1];
      if (!players.some((p) => p.url === url)) {
        players.push({ name: 'Direct ' + (url.includes('.m3u8') ? 'HLS' : 'MP4'), url });
      }
    }
  });

  return players;
}

// ─────────────────────────────────────────────
// NIVEAU 3 : Résoudre l'URL finale du stream
// ─────────────────────────────────────────────

/**
 * Prend l'URL d'un lecteur (iframe/embed) et essaie d'extraire l'URL du stream.
 * Si c'est déjà un .mp4/.m3u8, le retourne directement.
 */
export async function resolveStreamUrl(playerUrl) {
  // Déjà une URL directe ?
  if (/\.(mp4|m3u8|mkv|avi)(\?|$)/i.test(playerUrl)) {
    return playerUrl;
  }

  try {
    const { data: html } = await client.get(playerUrl);
    const $ = cheerio.load(html);

    // 1. Balise <video>
    const videoSrc = $('video source').attr('src') || $('video').attr('src');
    if (videoSrc) return resolveUrl(videoSrc);

    // 2. Chercher dans les scripts
    const allScripts = $('script').map((_, el) => $(el).html()).get().join('\n');

    // HLS (.m3u8)
    const m3u8 = allScripts.match(/['"]((https?:)?\/\/[^'"]*\.m3u8[^'"]*)['"]/);
    if (m3u8) return m3u8[1].startsWith('//') ? 'https:' + m3u8[1] : m3u8[1];

    // MP4
    const mp4 = allScripts.match(/['"]((https?:)?\/\/[^'"]*\.mp4[^'"]*)['"]/);
    if (mp4) return mp4[1].startsWith('//') ? 'https:' + mp4[1] : mp4[1];

    // Pattern "file:" ou "src:" dans un objet JS
    const fileMatch = allScripts.match(/(?:file|src|source|video_url)\s*[:=]\s*['"]([^'"]+)['"]/);
    if (fileMatch) return resolveUrl(fileMatch[1]);

    // 3. Iframe imbriqué (récursion 1 niveau)
    const nestedIframe = $('iframe[src]').first().attr('src');
    if (nestedIframe && nestedIframe !== playerUrl) {
      return resolveStreamUrl(resolveUrl(nestedIframe));
    }

    // Pas trouvé — retourner l'URL du player (l'app peut essayer de la lire directement)
    return playerUrl;
  } catch (error) {
    console.error('resolveStreamUrl error:', error.message);
    return playerUrl;
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function resolveUrl(url) {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE_URL + url;
  if (url.startsWith('http')) return url;
  return BASE_URL + '/' + url;
}

function cleanText(text) {
  return (text || '').replace(/\s+/g, ' ').trim().substring(0, 200);
}

function guessPlayerName(url, index) {
  const host = extractHost(url);
  if (host) {
    // Nettoyer le nom du host
    const name = host
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|io|cc|to|me|tv|info|co)$/, '')
      .replace(/\./g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return `Lecteur ${index + 1}`;
}

function extractHost(url) {
  try {
    const match = url.match(/\/\/([^/]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function dedup(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.pageUrl || seen.has(item.pageUrl)) return false;
    seen.add(item.pageUrl);
    return true;
  });
}

export { BASE_URL };
