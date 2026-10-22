/**
 * Tibia NPC Scraper Engine
 * Soporta:
 * 1. Servidor Local (/api/scrape?url=...)
 * 2. API oficial MediaWiki de Fandom con CORS origin=*
 * 3. Proxies CORS públicos (allorigins.win / corsproxy.io)
 * 4. Parseo directo de texto HTML y Wikitext
 */

const TibiaScraper = {
  // Extraer nombre de página desde URL o término
  extractPageTitle(input) {
    let clean = input.trim();
    if (!clean) return '';
    
    // Si es una URL completa
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const parsed = new URL(clean);
        const parts = parsed.pathname.split('/');
        const lastPart = parts[parts.length - 1];
        return decodeURIComponent(lastPart).replace(/_/g, ' ');
      } catch (e) {
        return clean;
      }
    }
    return clean;
  },

  // Normalizar URL a Fandom Wiki si es solo un nombre
  normalizeUrl(input) {
    let clean = input.trim();
    if (!clean) return '';
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    const formatted = clean.replace(/\s+/g, '_');
    return `https://tibia.fandom.com/wiki/${encodeURIComponent(formatted)}`;
  },

  // Limpiar y asegurar URL válida de imagen para Wikia/Fandom
  cleanImageUrl(rawUrl) {
    if (!rawUrl) return '';
    let url = rawUrl.trim();
    if (url.startsWith('data:image')) return '';
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }
    url = url.replace(/&amp;/g, '&');

    // Si es una imagen de Fandom/Wikia
    if (url.includes('wikia.nocookie.net') || url.includes('fandom.com')) {
      // Remover modificadores de recorte/escala (/window-crop/..., /scale-to-width-down/...)
      url = url.replace(/\/revision\/latest\/[^\?]+/, '/revision/latest');

      // IMPORTANTE: El CDN de Fandom retorna 404 si se quita /revision/
      if (!url.includes('/revision/')) {
        const qIdx = url.indexOf('?');
        if (qIdx !== -1) {
          url = url.slice(0, qIdx) + '/revision/latest?path-prefix=en';
        } else {
          url = url + '/revision/latest?path-prefix=en';
        }
      }

      // Asegurar que contenga path-prefix=en (el CDN de Fandom devuelve 404 si falta)
      if (!url.includes('path-prefix=')) {
        url += (url.includes('?') ? '&' : '?') + 'path-prefix=en';
      }
    }
    return url;
  },

  // Algoritmo MD5 estándar de MediaWiki para generar URLs exactas de sprites de Tibia Wiki
  md5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      var lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000);
      var lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000);
      var lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
      if (lX4 & lY4) return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        else return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
      } else return (lResult ^ lX8 ^ lY8);
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(str) {
      var lWordCount, lMessageLength = str.length;
      var lNumberOfWords_temp1 = lMessageLength + 8;
      var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      var lWordArray = Array(lNumberOfWords - 1);
      var lBytePosition = 0, lByteCount = 0;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function wordToHex(lValue) {
      var WordToHexValue = '', lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        var temp = '0' + lByte.toString(16);
        WordToHexValue += temp.substr(temp.length - 2, 2);
      }
      return WordToHexValue;
    }
    var x = convertToWordArray(string);
    var k, AA, BB, CC, DD, a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
      a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
      c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
      c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
      a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
      c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
      a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
      c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
      a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
      a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
      c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
      a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
      c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
      a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
      c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
      a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
      c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
      a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
      c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
      a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
      c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
      a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
      c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
      a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
      c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
      a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
      c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
      a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
      c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
      a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  },

  // Generador oficial infalible de URL de miniatura de item de Tibia Fandom
  getFandomItemIconUrl(itemName) {
    if (!itemName) return '';
    let name = itemName.trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
    const filename = name.replace(/\s+/g, '_') + '.gif';
    const hash = this.md5(filename);
    const h1 = hash[0];
    const h2 = hash.substring(0, 2);
    return `https://static.wikia.nocookie.net/tibia/images/${h1}/${h2}/${encodeURIComponent(filename)}/revision/latest?path-prefix=en`;
  },

  // Extraer la mejor URL de un elemento <img> (soporta lazy-load de MediaWiki y evita placeholders base64)
  extractBestImageUrl(imgEl) {
    if (!imgEl) return '';
    const candidates = [
      imgEl.getAttribute('data-src'),
      imgEl.getAttribute('data-image-src'),
      imgEl.getAttribute('data-original'),
      imgEl.getAttribute('src')
    ];

    for (const c of candidates) {
      if (c && !c.startsWith('data:image') && !c.includes('transparent.gif')) {
        return this.cleanImageUrl(c);
      }
    }
    return '';
  },

  // Estrategia 1: Servidor Local
  async fetchViaLocalProxy(targetUrl) {
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(targetUrl)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return {
        html: data.html || '',
        wikitext: data.wikitext || '',
        title: data.title || ''
      };
    } catch (e) {
      throw e;
    }
  },

  // Estrategia 2: MediaWiki API (Fandom) con origin=*
  async fetchViaMediaWikiApi(pageTitle) {
    const title = pageTitle.replace(/\s+/g, '_');
    const apiUrl = `https://tibia.fandom.com/api.php?action=parse&page=${encodeURIComponent(title)}&redirects=1&prop=text|wikitext|images&format=json&origin=*`;
    
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`MediaWiki API error ${res.status}`);
    const data = await res.json();
    if (data.error) {
      throw new Error(`MediaWiki: ${data.error.info || 'Página no encontrada'}`);
    }
    return {
      html: data.parse?.text?.['*'] || '',
      wikitext: data.parse?.wikitext?.['*'] || '',
      title: data.parse?.title || pageTitle
    };
  },

  // Estrategia 3: Proxies CORS Públicos
  async fetchViaCorsProxy(targetUrl) {
    const proxies = [
      (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`
    ];

    let lastError = null;
    for (const proxyGen of proxies) {
      try {
        const proxyUrl = proxyGen(targetUrl);
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 200) return text;
        }
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('No se pudo conectar a los proxies públicos');
  },

  // Flujo maestro de scraping
  async scrapeNpc(input, onProgress = () => {}) {
    onProgress('Analizando URL o nombre del NPC...');
    const pageTitle = this.extractPageTitle(input);
    const targetUrl = this.normalizeUrl(input);

    let htmlContent = '';
    let wikitextContent = '';
    let resolvedTitle = pageTitle;

    // 0. Si estamos en la aplicación de escritorio nativa (Electron)
    if (window.desktopAPI && window.desktopAPI.scrapeDirect) {
      try {
        onProgress('Descargando datos en la app de escritorio...');
        const desktopRes = await window.desktopAPI.scrapeDirect(targetUrl);
        if (desktopRes && desktopRes.success && desktopRes.html) {
          if (!desktopRes.html.includes('<title>Just a moment...') && !desktopRes.html.includes('cf-browser-verification')) {
            htmlContent = desktopRes.html;
            if (desktopRes.wikitext) wikitextContent = desktopRes.wikitext;
            if (desktopRes.title) resolvedTitle = desktopRes.title;
            onProgress('Datos obtenidos exitosamente.');
          }
        }
      } catch (desktopErr) {
        console.warn('Fallback desde scraper de escritorio a API:', desktopErr);
      }
    }

    if (!htmlContent) {
      // 1. Probar proxy local de Node / server.js
      try {
        onProgress('Consultando servidor local...');
        const localData = await this.fetchViaLocalProxy(targetUrl);
        if (localData && localData.html) {
          htmlContent = localData.html;
          wikitextContent = localData.wikitext || '';
          resolvedTitle = localData.title || pageTitle;
          onProgress('Datos obtenidos desde servidor local.');
        }
      } catch (localErr) {
        // 2. Probar MediaWiki API oficial de Fandom
        try {
          onProgress('Consultando API oficial de Tibia Wiki...');
          const mwData = await this.fetchViaMediaWikiApi(pageTitle);
          htmlContent = mwData.html;
          wikitextContent = mwData.wikitext;
          resolvedTitle = mwData.title || pageTitle;
          onProgress('Datos obtenidos vía API oficial.');
        } catch (mwErr) {
          // 3. Probar CORS Proxies públicos
          try {
            onProgress('Intentando conexión vía CORS Proxy...');
            htmlContent = await this.fetchViaCorsProxy(targetUrl);
            onProgress('Datos obtenidos vía proxy.');
          } catch (proxyErr) {
            throw new Error(
              `No se pudo descargar automáticamente: ${proxyErr.message || mwErr.message}. ` +
              `Puedes usar la pestaña de "Pegar HTML".`
            );
          }
        }
      }
    }

    onProgress('Extrayendo atributos, items y mapa...');
    const parsedData = this.parseNpcFromContent(htmlContent, wikitextContent, resolvedTitle, targetUrl);
    return parsedData;
  },

  // Parsear contenido HTML y Wikitext
  parseNpcFromContent(html, wikitext = '', defaultName = '', sourceUrl = '') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Nombre
    let name = defaultName;
    if (wikitext) {
      const wtNameMatch = wikitext.match(/\|\s*name\s*=\s*([^|\r\n]+)/i);
      if (wtNameMatch) {
        name = wtNameMatch[1].replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/[\[\]]/g, '').trim();
      }
    }
    if (!name) {
      const headerTitle = doc.querySelector('.page-header__title, #firstHeading, .portable-infobox h2, h1');
      if (headerTitle && headerTitle.textContent.trim()) {
        name = headerTitle.textContent.trim();
      }
    }
    if (!name && sourceUrl) {
      name = this.extractPageTitle(sourceUrl);
    }

    // 2. Imagen / Sprite del NPC
    let imageUrl = '';
    
    // Primero: si wikitext tiene | image = Nombre.gif
    if (wikitext) {
      const imgMatch = wikitext.match(/\|\s*image\s*=\s*([^|\r\n]+)/i);
      if (imgMatch) {
        const imgName = imgMatch[1].trim().replace(/[\[\]]/g, '');
        if (imgName && !imgName.toLowerCase().includes('bubble')) {
          const targetImg = doc.querySelector(`img[data-image-name*="${imgName}" i], img[src*="${imgName}" i], img[data-src*="${imgName}" i]`);
          if (targetImg) {
            imageUrl = this.extractBestImageUrl(targetImg);
          } else {
            imageUrl = this.getFandomItemIconUrl(imgName);
          }
        }
      }
    }

    // Segundo: buscar en contenedores oficiales de avatar de Tibia Wiki (#twbox-image, .twbox-image, etc.)
    if (!imageUrl) {
      const avatarContainers = doc.querySelectorAll('#twbox-image img, .twbox-image img, #twbox-profile img, .infobox-image img, .portable-infobox figure img, .pi-image-thumbnail');
      for (const img of avatarContainers) {
        const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').toLowerCase();
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        if (src.includes('bubble') || alt.includes('bubble') || src.includes('minimap') || src.includes('gold_icon')) continue;
        const best = this.extractBestImageUrl(img);
        if (best) {
          imageUrl = best;
          break;
        }
      }
    }

    // Tercero: buscar imagen cuyo nombre o src contenga el nombre del NPC (ej. Alaistar.gif, Alexander.gif)
    if (!imageUrl && name) {
      const cleanUnderscore = name.replace(/\s+/g, '_');
      const cleanSimple = name.split(' ')[0];
      const nameImg = doc.querySelector(
        `img[src*="${cleanUnderscore}.gif" i], img[data-src*="${cleanUnderscore}.gif" i], img[data-image-name*="${cleanUnderscore}" i], img[src*="${cleanSimple}.gif" i]`
      );
      if (nameImg) {
        const best = this.extractBestImageUrl(nameImg);
        if (best && !best.toLowerCase().includes('bubble')) {
          imageUrl = best;
        }
      }
    }

    // Cuarto: fórmula infalible oficial de Fandom para el sprite del NPC [Nombre].gif
    if (!imageUrl && name) {
      imageUrl = this.getFandomItemIconUrl(name);
    }

    // 3. Datos del Infobox (Ciudad, Trabajo, Ubicación, Género, Raza)
    let city = '';
    let location = '';
    let job = '';
    let race = 'Humano';
    let gender = '';
    let coordinates = { x: '', y: '', z: '7' };
    let mapUrl = '';

    // Si wikitext está presente, extraer campos oficiales con máxima precisión
    if (wikitext) {
      const matchField = (field) => {
        const m = wikitext.match(new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\r\\n|}]+)`, 'i'));
        return m ? m[1].replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/[\[\]]/g, '').trim() : '';
      };

      const wtName = matchField('name');
      const wtCity = matchField('city');
      const wtJob = matchField('job');
      const wtLocation = matchField('location');
      const wtPosx = matchField('posx');
      const wtPosy = matchField('posy');
      const wtPosz = matchField('posz');

      if (wtName) name = wtName;
      if (wtCity) city = wtCity;
      if (wtJob) job = wtJob;
      if (wtLocation) location = wtLocation;

      if (wtPosx && wtPosy) {
        const px = wtPosx.split('.');
        const py = wtPosy.split('.');
        if (px.length === 2 && py.length === 2) {
          const calcX = (parseInt(px[0], 10) * 256) + parseInt(px[1], 10);
          const calcY = (parseInt(py[0], 10) * 256) + parseInt(py[1], 10);
          const calcZ = wtPosz || '7';
          coordinates = { x: String(calcX), y: String(calcY), z: String(calcZ) };
          mapUrl = `https://tibiamaps.io/map#${calcX},${calcY},${calcZ}:2`;
        }
      }
    }

    // Buscar en tablas de infobox o portable-infobox de HTML
    const infoRows = doc.querySelectorAll('.pi-item, tr, .infobox tr');
    infoRows.forEach(row => {
      const labelEl = row.querySelector('.pi-data-label, th');
      const valEl = row.querySelector('.pi-data-value, td');
      if (!labelEl || !valEl) return;

      const label = labelEl.textContent.trim().toLowerCase();
      const val = valEl.textContent.trim();

      if (!city && (label.includes('city') || label.includes('ciudad'))) {
        city = val;
      } else if (!location && (label.includes('location') || label.includes('ubicación') || label.includes('ubicacion'))) {
        location = val;
      } else if (!job && (label.includes('job') || label.includes('trabajo') || label.includes('profesión') || label.includes('ocupación'))) {
        job = val;
      } else if (label.includes('race') || label.includes('raza')) {
        race = val;
      } else if (label.includes('gender') || label.includes('género') || label.includes('genero')) {
        gender = val;
      }
    });

    if (!city && location) {
      city = location.split(',')[0].trim();
    }
    if (!location && city) {
      location = city;
    }

    // 4. Coordenadas del Mapa (si no se extrajeron del wikitext)
    if (!coordinates.x) {
      const mapperLinks = doc.querySelectorAll('a[href*="Mapper?coords="], a[href*="coords="]');
      for (const link of mapperLinks) {
        const href = link.getAttribute('href') || '';
        const mapperMatch = href.match(/coords=(\d+)\.(\d+)-(\d+)\.(\d+)-(\d+)/);
        if (mapperMatch) {
          const calcX = (parseInt(mapperMatch[1], 10) * 256) + parseInt(mapperMatch[2], 10);
          const calcY = (parseInt(mapperMatch[3], 10) * 256) + parseInt(mapperMatch[4], 10);
          const calcZ = mapperMatch[5];
          coordinates = { x: String(calcX), y: String(calcY), z: String(calcZ) };
          mapUrl = `https://tibiamaps.io/map#${calcX},${calcY},${calcZ}:2`;
          break;
        }
      }
    }

    // Buscar enlaces a tibiamaps.io si no hubo mapper
    if (!coordinates.x) {
      const mapLinks = doc.querySelectorAll('a[href*="tibiamaps.io"]');
      for (const link of mapLinks) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/map#(\d+),(\d+),(\d+)/);
        if (match) {
          coordinates = { x: match[1], y: match[2], z: match[3] };
          mapUrl = `https://tibiamaps.io/map#${match[1]},${match[2]},${match[3]}:2`;
          break;
        }
      }
    }

    // Buscar patrones de texto Mapper o coordenadas numéricas
    if (!coordinates.x) {
      const fullText = (doc.body ? doc.body.innerHTML : '') + ' ' + wikitext;
      const mapperTextMatch = fullText.match(/coords=(\d+)\.(\d+)-(\d+)\.(\d+)-(\d+)/);
      if (mapperTextMatch) {
        const calcX = (parseInt(mapperTextMatch[1], 10) * 256) + parseInt(mapperTextMatch[2], 10);
        const calcY = (parseInt(mapperTextMatch[3], 10) * 256) + parseInt(mapperTextMatch[4], 10);
        const calcZ = mapperTextMatch[5];
        coordinates = { x: String(calcX), y: String(calcY), z: String(calcZ) };
        mapUrl = `https://tibiamaps.io/map#${calcX},${calcY},${calcZ}:2`;
      } else {
        const coordMatch = fullText.match(/(\d{5})[,\s|]+(\d{5})[,\s|]+(\d{1,2})/);
        if (coordMatch) {
          coordinates = { x: coordMatch[1], y: coordMatch[2], z: coordMatch[3] };
          mapUrl = `https://tibiamaps.io/map#${coordMatch[1]},${coordMatch[2]},${coordMatch[3]}:2`;
        }
      }
    }

    // Detección de ubicación o área específica si no se extrajo del infobox
    if (!location || location === city) {
      // Buscar enlaces como <a href="/wiki/Upper_Rathleton" title="Upper Rathleton">Upper Rathleton</a>
      const areaLinks = doc.querySelectorAll('a[href*="/wiki/"]:not([href*="Mapper"]):not([href*="File:"]):not([href*="#"])');
      for (const al of areaLinks) {
        const t = (al.textContent || '').trim();
        const title = (al.getAttribute('title') || '').trim();
        const cand = title || t;
        if (
          cand.includes('Rathleton') || cand.includes('Thais') || cand.includes('Carlin') ||
          cand.includes('Venore') || cand.includes('Edron') || cand.includes('Darashia') ||
          cand.includes('Kazordoon') || cand.includes('Yalahar') || cand.includes('Ankrahmun') ||
          cand.includes('Svargrond') || cand.includes('Farmine') || cand.includes('Roshamuul')
        ) {
          location = cand;
          if (!city || city === 'Sin ciudad asignada') {
            city = cand.replace(/Upper\s+|Lower\s+|East\s+|West\s+/i, '').trim();
          }
          break;
        }
      }
    }

    // 5. Extraer Tablas de Items (Sells y Buys)
    const itemsSells = [];
    const itemsBuys = [];

    // Listas heurísticas de palabras clave para distinguir Compra vs Venta
    const CREATURE_PRODUCT_KEYWORDS = [
      'cowbell', 'flask', 'mask', 'pacifier', 'glooth', 'jaw', 'toe', 'mooh', 'horn',
      'rust', 'fang', 'hair', 'pearl', 'scale', 'heart', 'tentacle', 'vial', 'tail',
      'wing', 'claw', 'bone', 'eye', 'tooth', 'pelt', 'leather', 'essence', 'powder',
      'demonic', 'vampire', 'dust', 'honeycomb', 'wool', 'feather'
    ];

    const POTION_SUPPLY_KEYWORDS = [
      'potion', 'health potion', 'mana potion', 'spirit potion', 'rune', 'arrow',
      'bolt', 'bread', 'meat', 'cheese', 'rope', 'shovel', 'backpack'
    ];

    const allTables = doc.querySelectorAll('table');
    allTables.forEach((table, tableIndex) => {
      // 1. Detectar si la tabla es de Compra (Buys) o Venta (Sells)
      let isBuyTable = false;
      let isSellTable = false;

      // Buscar texto hacia atrás (nodos de texto y elementos anteriores)
      let backwardText = '';
      let prevNode = table.previousSibling;
      for (let i = 0; i < 12 && prevNode; i++) {
        backwardText = (prevNode.textContent || '').toLowerCase() + ' ' + backwardText;
        if (prevNode.nodeType === 1 && /^H[1-6]$/i.test(prevNode.tagName)) {
          break;
        }
        prevNode = prevNode.previousSibling;
      }

      // Buscar encabezados H1-H6 o identificadores anteriores en el árbol
      let nearestHeader = '';
      const allHeaders = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6, .mw-headline, [id]'));
      for (const h of allHeaders) {
        if (h.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) {
          nearestHeader = (h.textContent || '') + ' ' + (h.id || '');
        } else {
          break;
        }
      }

      const fullContext = (nearestHeader + ' ' + backwardText + ' ' + (table.className || '') + ' ' + (table.id || '')).toLowerCase();

      if (
        fullContext.includes('buys') ||
        fullContext.includes('items bought') ||
        fullContext.includes('bought') ||
        fullContext.includes('compra') ||
        fullContext.includes('comprados') ||
        fullContext.includes('trades/buys')
      ) {
        isBuyTable = true;
      } else if (
        fullContext.includes('sells') ||
        fullContext.includes('items sold') ||
        fullContext.includes('sold') ||
        fullContext.includes('vende') ||
        fullContext.includes('vendidos') ||
        fullContext.includes('trades/sells')
      ) {
        isSellTable = true;
      }

      // Heurística de contenido si el encabezado no fue concluyente
      const tableRawText = table.textContent.toLowerCase();
      let creatureScore = 0;
      let potionScore = 0;

      CREATURE_PRODUCT_KEYWORDS.forEach(kw => {
        if (tableRawText.includes(kw)) creatureScore++;
      });
      POTION_SUPPLY_KEYWORDS.forEach(kw => {
        if (tableRawText.includes(kw)) potionScore++;
      });

      if (!isBuyTable && !isSellTable) {
        if (creatureScore > potionScore) {
          isBuyTable = true;
        } else if (potionScore > creatureScore) {
          isSellTable = true;
        } else if (tableIndex === 0 && allTables.length >= 2) {
          // Generalmente si hay 2 tablas y una tiene BUYS antes
          isBuyTable = fullContext.includes('buy') || backwardText.includes('buys');
        }
      }

      // Parsear filas
      const rows = table.querySelectorAll('tr');
      rows.forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 2) return; // Omitir cabeceras o filas vacías

        // A. IMAGEN DEL ITEM (Capturar correctamente la miniatura con soporte lazy-load y sin romper URL)
        let itemImg = '';
        for (const cell of cells) {
          const imgs = cell.querySelectorAll('img');
          for (const img of imgs) {
            const alt = (img.getAttribute('alt') || '').toLowerCase();
            const src = (img.getAttribute('src') || img.getAttribute('data-src') || '').toLowerCase();
            // Ignorar icono de moneda de oro (Gold Icon, etc.)
            if (
              src.includes('gold_icon') ||
              src.includes('platinum_coin') ||
              src.includes('crystal_coin') ||
              alt.includes('gold icon') ||
              alt === 'gold'
            ) {
              continue;
            }
            const clean = this.extractBestImageUrl(img);
            if (clean) {
              itemImg = clean;
              break;
            }
          }
          if (itemImg) break;
        }

        // B. NOMBRE DEL ITEM
        let itemName = '';
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const wikiLink = cell.querySelector('a[href*="/wiki/"]:not([href*="#notes"]):not([href*="Mapper"])');
          if (wikiLink) {
            const linkText = wikiLink.textContent.trim();
            const linkTitle = wikiLink.getAttribute('title') || '';
            if (linkText && !linkText.match(/^\d+$/)) {
              itemName = linkText;
              break;
            } else if (linkTitle && !linkTitle.includes('File:') && !linkTitle.includes('Gold')) {
              itemName = linkTitle;
              break;
            }
          }
        }

        if (!itemName) {
          const targetCell = cells.length >= 2 ? cells[1] : cells[0];
          const clone = targetCell.cloneNode(true);
          clone.querySelectorAll('sup, sub, small, .icon, img').forEach(el => el.remove());
          itemName = clone.textContent.trim();
        }

        // Limpiar notas residuales como [1] o números aislados
        itemName = itemName.replace(/\[\d+\]/g, '').replace(/[\r\n\t]+/g, ' ').trim();

        // C. PRECIO
        let price = 0;
        for (let i = cells.length - 1; i >= 0; i--) {
          const cell = cells[i];
          const clone = cell.cloneNode(true);
          clone.querySelectorAll('.icon, img, span[title="Gold"], sup, sub').forEach(el => el.remove());
          const text = clone.textContent.trim().replace(/,/g, '');
          const digitsMatch = text.match(/\b\d+\b/);
          if (digitsMatch) {
            price = parseInt(digitsMatch[0], 10);
            break;
          }
        }

        // D. NOTAS
        let notes = '';
        if (cells.length >= 4) {
          notes = cells[cells.length - 1].textContent.trim();
        }

        // Validar que sea un nombre de item real (no diálogos de wiki, scripts o transcripciones)
        if (
          !itemName ||
          itemName.length > 60 ||
          itemName.includes('Player:') ||
          itemName.includes('Transcript') ||
          itemName.includes('Dialogue') ||
          itemName.includes('<end of conversation>') ||
          itemName.startsWith('NPC:') ||
          /^[A-Z][a-z]+:\s/.test(itemName)
        ) {
          return;
        }

        if (itemName && !isNaN(price)) {
          // Si no se encontró imagen o vino con placeholder base64, generar con la fórmula MD5 oficial de Fandom
          if (!itemImg || itemImg.startsWith('data:image')) {
            itemImg = this.getFandomItemIconUrl(itemName);
          }

          const itemObj = {
            name: itemName,
            price: price,
            currency: 'gp',
            notes: notes,
            icon: itemImg
          };

          if (isBuyTable) {
            if (!itemsBuys.some(i => i.name.toLowerCase() === itemName.toLowerCase())) {
              itemsBuys.push(itemObj);
            }
          } else {
            if (!itemsSells.some(i => i.name.toLowerCase() === itemName.toLowerCase())) {
              itemsSells.push(itemObj);
            }
          }
        }
      });
    });

    // Estrategia B: Si wikitext está presente y las tablas no arrojaron items, parsear plantillas wikitext
    if (itemsSells.length === 0 && itemsBuys.length === 0 && wikitext) {
      // Regex para plantillas {{Trades/Buys|Item Name|Price|...}} o listas
      const tradeBuyMatches = wikitext.matchAll(/\{\{Trades\/Buys\|([^|]+)\|([^|]+)(?:\|([^}]+))?\}\}/gi);
      for (const m of tradeBuyMatches) {
        const itmName = m[1].trim();
        itemsBuys.push({
          name: itmName,
          price: parseInt(m[2].replace(/[^\d]/g, ''), 10) || 0,
          currency: 'gp',
          notes: m[3] ? m[3].trim() : '',
          icon: this.getFandomItemIconUrl(itmName)
        });
      }

      const tradeSellMatches = wikitext.matchAll(/\{\{Trades\/Sells\|([^|]+)\|([^|]+)(?:\|([^}]+))?\}\}/gi);
      for (const m of tradeSellMatches) {
        const itmName = m[1].trim();
        itemsSells.push({
          name: itmName,
          price: parseInt(m[2].replace(/[^\d]/g, ''), 10) || 0,
          currency: 'gp',
          notes: m[3] ? m[3].trim() : '',
          icon: this.getFandomItemIconUrl(itmName)
        });
      }
    }

    return {
      id: 'npc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name || defaultName || 'NPC Desconocido',
      city: city || 'Sin ciudad asignada',
      location: location || city || 'Ubicación desconocida',
      job: job || 'Comerciante / NPC',
      race: race,
      gender: gender,
      imageUrl: imageUrl || '',
      coordinates: {
        x: coordinates.x || '',
        y: coordinates.y || '',
        z: coordinates.z || '7'
      },
      mapUrl: mapUrl || (coordinates.x && coordinates.y ? `https://tibiamaps.io/map#${coordinates.x},${coordinates.y},${coordinates.z}:2` : ''),
      itemsSells: itemsSells,
      itemsBuys: itemsBuys,
      sourceUrl: sourceUrl || '',
      updatedAt: new Date().toISOString()
    };
  },

  // Extraer y parsear Monstruo o Boss desde TibiaWiki
  async scrapeMonster(nameOrTitle, onProgress = () => {}) {
    const pageTitle = this.extractPageTitle(nameOrTitle);
    const targetUrl = this.normalizeUrl(nameOrTitle);

    let htmlContent = '';
    let wikitextContent = '';
    let resolvedTitle = pageTitle;

    // 1. Probar servidor local
    try {
      onProgress(`Consultando proxy local para "${resolvedTitle}"...`);
      const localData = await this.fetchViaLocalProxy(targetUrl);
      htmlContent = localData.html;
      wikitextContent = localData.wikitext;
      if (localData.title) resolvedTitle = localData.title;
    } catch (e1) {
      // 2. Probar MediaWiki API directa
      try {
        onProgress(`Consultando MediaWiki API para "${resolvedTitle}"...`);
        const apiData = await this.fetchViaMediaWikiApi(resolvedTitle);
        htmlContent = apiData.html;
        wikitextContent = apiData.wikitext;
        if (apiData.title) resolvedTitle = apiData.title;
      } catch (e2) {
        // 3. Fallback a proxy CORS
        onProgress('Consultando proxy CORS...');
        htmlContent = await this.fetchViaCorsProxy(targetUrl);
      }
    }

    if (!wikitextContent && !htmlContent) {
      throw new Error(`No se pudo obtener información de "${resolvedTitle}" desde TibiaWiki.`);
    }

    return this.parseMonsterData(resolvedTitle, wikitextContent, htmlContent);
  },

  // Parsear wikitext oficial de una criatura o boss de TibiaWiki
  parseMonsterData(name, wikitext = '', html = '') {
    // Parser robusto de parámetros de infobox línea por línea
    const params = {};
    if (wikitext) {
      const lines = wikitext.split('\n');
      let currentKey = null;
      let currentVal = [];

      for (const line of lines) {
        const match = line.match(/^\|\s*([a-zA-Z0-9_-]+)\s*=\s*(.*)$/);
        if (match) {
          if (currentKey) params[currentKey] = currentVal.join('\n').trim();
          currentKey = match[1].toLowerCase().trim();
          currentVal = [match[2]];
        } else if (currentKey) {
          currentVal.push(line);
        }
      }
      if (currentKey) params[currentKey] = currentVal.join('\n').trim();
    }

    const clean = (t) => {
      if (!t) return '';
      return t
        .replace(/\{\{Mapper Coords\|[^|}]+\|[^|}]+\|[^|}]+\|[^|}]+\|text=([^|}]+)\}\}/gi, (m, txt) => txt)
        .replace(/\{\{Mapper Coords[^}]*\}\}/gi, '')
        .replace(/\{\{seealso[^}]*\}\}/gi, '')
        .replace(/\{\{officialnewsarchive[^}]*\}\}/gi, '')
        .replace(/\[\[(?:([^\]|]+)\|)?([^\]]+)\]\]/g, (m, p1, p2) => p2 || p1 || '')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/<gallery[\s\S]*?<\/gallery>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const getParam = (k) => params[k.toLowerCase()] || '';

    // Validar si es una página de categoría vacía
    if (wikitext && !/\{\{Infobox Creature/i.test(wikitext) && (wikitext.includes('{{#dpl:') || /Category:Creature Types/i.test(wikitext))) {
      throw new Error(`"${name}" no es una criatura válida; es una página de categoría o tipo de monstruos en TibiaWiki.`);
    }

    const monster = {
      name: name,
      updatedAt: new Date().toISOString()
    };

    // 1. Health (HP) & Experience (EXP)
    const hpStr = clean(getParam('hp'));
    if (hpStr) {
      const num = parseInt(hpStr.replace(/[^0-9]/g, ''), 10);
      monster.hp = !isNaN(num) ? num : (hpStr.includes('?') ? '?' : hpStr);
    }
    const expStr = clean(getParam('exp'));
    if (expStr) {
      const num = parseInt(expStr.replace(/[^0-9]/g, ''), 10);
      monster.exp = !isNaN(num) ? num : (expStr.includes('?') ? '?' : expStr);
    }

    // 2. Boss & Raid detection
    const spawntypeRaw = clean(getParam('spawntype')).toLowerCase();
    const isbossField = clean(getParam('isboss')).toLowerCase();
    monster.isBoss = isbossField === 'yes' || spawntypeRaw.includes('boss');
    if (spawntypeRaw.includes('raid')) monster.isRaid = true;

    // 3. Bosstiary Class & Cooldown (para bosses)
    const bosstiaryclass = clean(getParam('bosstiaryclass')) || clean(getParam('bossclass'));
    if (bosstiaryclass) {
      monster.bosstiaryclass = bosstiaryclass;
      monster.isBoss = true;
    }

    const cooldown = clean(getParam('cooldown'));
    if (cooldown) {
      monster.cooldown = cooldown;
      monster.isBoss = true;
    }

    // 4. Bestiary Level, Occurrence, Charm Points & Kills to Unlock
    const bLevel = clean(getParam('bestiarylevel')) || 'Medium';
    monster.bestiarylevel = bLevel;
    const occ = clean(getParam('occurrence')) || 'Common';
    monster.occurrence = occ;

    const isVeryRare = occ.toLowerCase() === 'very rare';
    const bLower = bLevel.toLowerCase();

    if (monster.isBoss) {
      // Los bosses no otorgan Bestiary charm points
      monster.charm = 0;
      monster.killsToUnlock = null;
    } else {
      // Reglas oficiales del Bestiario de Tibia (Template:Bestiary Table)
      if (bLower.includes('harmless')) {
        monster.charm = isVeryRare ? 5 : 1;
        monster.killsToUnlock = isVeryRare ? 5 : 25;
      } else if (bLower.includes('trivial')) {
        monster.charm = isVeryRare ? 10 : 5;
        monster.killsToUnlock = isVeryRare ? 5 : 250;
      } else if (bLower.includes('easy')) {
        monster.charm = isVeryRare ? 30 : 15;
        monster.killsToUnlock = isVeryRare ? 5 : 500;
      } else if (bLower.includes('medium')) {
        monster.charm = isVeryRare ? 50 : 25;
        monster.killsToUnlock = isVeryRare ? 5 : 1000;
      } else if (bLower.includes('hard')) {
        monster.charm = isVeryRare ? 100 : 50;
        monster.killsToUnlock = isVeryRare ? 5 : 2500;
      } else if (bLower.includes('challenging') || bLower.includes('very hard')) {
        monster.charm = isVeryRare ? 200 : 100;
        monster.killsToUnlock = isVeryRare ? 5 : 5000;
      } else {
        monster.charm = 25;
        monster.killsToUnlock = 1000;
      }
    }



    // 7. Damage Taken From Elements (todos los elementos oficiales de TibiaWiki)
    const elements = {};
    const elemMap = {
      physical: 'physicaldmgmod',
      energy: 'energydmgmod',
      earth: 'earthdmgmod',
      fire: 'firedmgmod',
      ice: 'icedmgmod',
      holy: 'holydmgmod',
      death: 'deathdmgmod',
      healing: 'healmod',
      drown: 'drowndmgmod',
      lifeDrain: 'hpdraindmgmod'
    };
    let hasElements = false;
    for (const [key, field] of Object.entries(elemMap)) {
      const raw = getParam(field);
      if (raw) {
        const cleanedMod = clean(raw).replace(/\?/g, '').trim();
        elements[key] = cleanedMod.includes('%') ? cleanedMod : `${cleanedMod}%`;
        hasElements = true;
      }
    }
    if (hasElements) monster.elements = elements;

    // 8. Location (Ubicación completa y limpia)
    const rawLoc = getParam('location');
    if (rawLoc) {
      monster.location = clean(rawLoc);
    }

    // Tabla de Botín (Loot) - Prioridad 1: Tabla HTML renderizada oficial (con porcentajes exactos)
    let lootList = [];
    if (html && html.includes('wikitable sortable')) {
      const tableMatch = html.match(/<table class="wikitable sortable"[^>]*>([\s\S]*?)<\/table>/i);
      if (tableMatch) {
        const rowMatches = [...tableMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
        for (const row of rowMatches) {
          const rowContent = row[1];
          if (rowContent.includes('<th>')) continue;
          const cols = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].trim());
          if (cols.length < 5) continue;

          const nameMatch = cols[1].match(/<a[^>]*>([^<]+)<\/a>/i);
          const itemName = nameMatch ? nameMatch[1].trim() : cols[1].replace(/<[^>]+>/g, '').trim();
          if (!itemName || itemName.toLowerCase() === 'empty') continue;

          const count = cols[3].replace(/<[^>]+>/g, '').trim() || '1';
          const lastCol = cols[cols.length - 1];
          const pctMatch = lastCol.replace(/<[^>]+>/g, '').trim();
          const num = parseFloat(pctMatch.replace(/%/g, ''));

          let rarity = 'common';
          if (!isNaN(num)) {
            if (num >= 99.9 || pctMatch.toLowerCase() === 'always') rarity = 'always';
            else if (num >= 25.0) rarity = 'common';
            else if (num >= 5.0) rarity = 'uncommon';
            else if (num >= 1.0) rarity = 'semi-rare';
            else if (num >= 0.5) rarity = 'rare';
            else if (num >= 0.1) rarity = 'very rare';
            else rarity = 'extremely rare';
          } else {
            if (lastCol.includes('loot-always')) rarity = 'always';
            else if (lastCol.includes('loot-common')) rarity = 'common';
            else if (lastCol.includes('loot-uncommon')) rarity = 'uncommon';
            else if (lastCol.includes('loot-semi-rare') || lastCol.includes('loot-semirare')) rarity = 'semi-rare';
            else if (lastCol.includes('loot-rare') && !lastCol.includes('semi')) rarity = 'rare';
            else if (lastCol.includes('loot-very-rare')) rarity = 'very rare';
            else if (lastCol.includes('loot-extremely-rare')) rarity = 'extremely rare';
          }

          lootList.push({
            count,
            item: itemName,
            percentage: pctMatch || '',
            rarity
          });
        }
      }
    }

    // Fallback 2: Parseo de wikitext {{Loot Item}} si no había tabla HTML
    if (lootList.length === 0) {
      const lootMatches = [...wikitext.matchAll(/\{\{Loot Item\|([^\}]+)\}\}/gi)];
      if (lootMatches.length > 0) {
        const VALID_RARITIES = ['always', 'common', 'uncommon', 'semi-rare', 'rare', 'very rare', 'extremely rare'];

        for (const m of lootMatches) {
          const parts = m[1].split('|').map(p => p.trim()).filter(Boolean);
          if (parts.length === 0) continue;

          let count = '1';
          let item = '';
          let rarity = '';

          if (parts.length >= 3) {
            count = parts[0];
            item = clean(parts[1]);
            const rLower = parts[2].toLowerCase().replace(/\?/g, '').trim();
            if (VALID_RARITIES.includes(rLower)) rarity = rLower;
          } else if (parts.length === 2) {
            const rLower = parts[1].toLowerCase().replace(/\?/g, '').trim();
            if (VALID_RARITIES.includes(rLower)) {
              item = clean(parts[0]);
              rarity = rLower;
            } else {
              count = parts[0];
              item = clean(parts[1]);
            }
          } else if (parts.length === 1) {
            item = clean(parts[0]);
          }

          if (!item || item.toLowerCase() === 'empty') continue;

          if (item.toLowerCase().includes('(always)') || count.toLowerCase().includes('(always)')) {
            rarity = 'always';
            item = item.replace(/\(always\)/gi, '').trim();
            count = count.replace(/\(always\)/gi, '').trim() || '1';
          }

          if (!rarity) {
            const itemLower = item.toLowerCase();
            if (itemLower === 'gold coin' || itemLower === 'platinum coin' || itemLower === 'crystal coin') {
              rarity = 'common';
            }
          }

          lootList.push({ count, item, percentage: '', rarity });
        }
      }
    }

    if (lootList.length > 0) {
      monster.loot = lootList;
    }

    return monster;
  }
};

// Exportar globalmente para navegador y node
if (typeof window !== 'undefined') {
  window.TibiaScraper = TibiaScraper;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TibiaScraper;
}

