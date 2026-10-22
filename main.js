const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, shell, Menu, session, dialog } = require('electron');
const https = require('https');
const http = require('http');



function getDataFilePath() {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'npcs_data.json');
  }
  return path.join(__dirname, 'npcs_data.json');
}

// Asegurar que el archivo de datos exista en la carpeta del programa
function ensureDataFile() {
  const dataPath = getDataFilePath();
  if (!fs.existsSync(dataPath)) {
    const bundledPath = path.join(__dirname, 'npcs_data.json');
    if (fs.existsSync(bundledPath)) {
      try {
        const userDir = path.dirname(dataPath);
        if (!fs.existsSync(userDir)) {
          fs.mkdirSync(userDir, { recursive: true });
        }
        fs.copyFileSync(bundledPath, dataPath);
        return;
      } catch (err) {
        console.error('Error al copiar npcs_data.json inicial:', err);
      }
    }
    fs.writeFileSync(dataPath, '[]', 'utf-8');
  }
}

// Helper para scraping directo desde Node.js sin bloqueos CORS
function fetchHtmlContent(targetUrl, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Demasiadas redirecciones'));

    try {
      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8'
        }
      };

      const req = client.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).toString();
          return resolve(fetchHtmlContent(redirectUrl, maxRedirects - 1));
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      });

      req.on('error', err => reject(err));
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error('Tiempo de espera agotado al descargar'));
      });
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

let mainWindow;

function createWindow() {
  ensureDataFile();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0d14',
    title: 'Freddy Fish Rush',
    icon: path.join(__dirname, 'app.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Cargar index.html directamente como archivo local de la app
  mainWindow.loadFile('index.html');

  // Quitar menú por defecto para que luzca como app nativa limpia
  Menu.setApplicationMenu(null);

  // Abrir enlaces externos (target="_blank" o window.open) en el navegador predeterminado del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-npcs', async () => {
  ensureDataFile();
  try {
    const dataPath = getDataFilePath();
    const raw = fs.readFileSync(dataPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error leyendo npcs_data.json:', e);
    return [];
  }
});

ipcMain.handle('save-npcs', async (event, npcs) => {
  ensureDataFile();
  try {
    const dataPath = getDataFilePath();
    fs.writeFileSync(dataPath, JSON.stringify(npcs, null, 2), 'utf-8');
    return { success: true, count: npcs.length, path: dataPath };
  } catch (e) {
    console.error('Error guardando en npcs_data.json:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('get-data-path', () => {
  return getDataFilePath();
});

ipcMain.handle('get-imbuements', async () => {
  try {
    const filePath = path.join(__dirname, 'imbuements_data.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
    return [];
  } catch (e) {
    console.error('Error leyendo imbuements_data.json:', e);
    return [];
  }
});

ipcMain.handle('get-creature-drops', async () => {
  try {
    const filePath = path.join(__dirname, 'creature_drops_data.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
    return {};
  } catch (e) {
    console.error('Error leyendo creature_drops_data.json:', e);
    return {};
  }
});

ipcMain.handle('get-monster-sprites', async () => {
  try {
    const filePath = path.join(__dirname, 'monster_sprites.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
    return {};
  } catch (e) {
    console.error('Error leyendo monster_sprites.json:', e);
    return {};
  }
});

ipcMain.handle('get-monsters-data', async () => {
  try {
    const filePath = path.join(__dirname, 'monsters_data.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
    return {};
  } catch (e) {
    console.error('Error leyendo monsters_data.json:', e);
    return {};
  }
});

ipcMain.handle('open-program-folder', async () => {
  try {
    const folderToOpen = app.isPackaged ? app.getPath('userData') : __dirname;
    await shell.openPath(folderToOpen);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
});

ipcMain.handle('scrape-web', async (event, inputUrl) => {
  try {
    let clean = (inputUrl || '').trim();
    let pageTitle = clean;

    // Extraer título de la página si es una URL completa
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      try {
        const parsed = new URL(clean);
        const parts = parsed.pathname.split('/').filter(Boolean);
        const lastPart = parts[parts.length - 1];
        if (lastPart) {
          pageTitle = decodeURIComponent(lastPart).replace(/_/g, ' ');
        }
      } catch (e) {
        pageTitle = clean;
      }
    }

    // Para URLs de Fandom o nombres de NPC, consultar la API oficial MediaWiki de Fandom
    // La API oficial NO tiene bloqueo de Cloudflare y devuelve el HTML limpio y el wikitext con datos exactos
    if (clean.includes('fandom.com') || !clean.startsWith('http')) {
      try {
        const apiUrl = `https://tibia.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageTitle.replace(/\s+/g, '_'))}&prop=text|wikitext|images&format=json`;
        const apiJsonStr = await fetchHtmlContent(apiUrl);
        const apiData = JSON.parse(apiJsonStr);
        if (apiData.parse && apiData.parse.text) {
          return {
            success: true,
            html: apiData.parse.text['*'],
            wikitext: apiData.parse.wikitext ? apiData.parse.wikitext['*'] : '',
            title: apiData.parse.title || pageTitle
          };
        }
      } catch (apiErr) {
        console.warn('Fallo en API MediaWiki interna, intentando descarga directa:', apiErr);
      }
    }

    // Descarga directa tradicional para otras URLs
    const html = await fetchHtmlContent(clean.startsWith('http') ? clean : `https://tibia.fandom.com/wiki/${encodeURIComponent(clean.replace(/\s+/g, '_'))}`);
    
    // Verificar si Cloudflare bloqueó la petición directa
    if (html.includes('<title>Just a moment...') || html.includes('cf-browser-verification')) {
      // Reintentar vía API
      const apiUrl = `https://tibia.fandom.com/api.php?action=parse&page=${encodeURIComponent(pageTitle.replace(/\s+/g, '_'))}&prop=text|wikitext|images&format=json`;
      const apiJsonStr = await fetchHtmlContent(apiUrl);
      const apiData = JSON.parse(apiJsonStr);
      if (apiData.parse && apiData.parse.text) {
        return {
          success: true,
          html: apiData.parse.text['*'],
          wikitext: apiData.parse.wikitext ? apiData.parse.wikitext['*'] : '',
          title: apiData.parse.title || pageTitle
        };
      }
      throw new Error('La página fue bloqueada por Cloudflare. Usa la pestaña "Pegar HTML" o ingresa el nombre del NPC.');
    }

    return { success: true, html };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-external-url', async (event, targetUrl) => {
  try {
    if (targetUrl) {
      await shell.openExternal(targetUrl);
      return true;
    }
  } catch (err) {
    console.error('Error al abrir URL externa:', err);
  }
  return false;
});

// Cache en memoria para consultas a Hakai Market
let cachedHakaiResult = null;
let lastHakaiCheck = 0;
const HAKAI_CACHE_TTL_MS = 60 * 1000; // 1 minuto de caché

ipcMain.handle('check-yasir-status', async (event, options = {}) => {
  const targetWorld = (options && options.targetWorld ? options.targetWorld : 'Solidera').trim();
  const force = !!(options && options.force);
  const now = Date.now();

  if (!force && cachedHakaiResult && (now - lastHakaiCheck < HAKAI_CACHE_TTL_MS)) {
    const normalizedTarget = targetWorld.toLowerCase();
    const isActiveInTarget = cachedHakaiResult.activeWorlds.some(w => w.toLowerCase() === normalizedTarget);
    return {
      ...cachedHakaiResult,
      targetWorld,
      isActiveInTarget
    };
  }

  let scraperWindow = null;
  try {
    scraperWindow = new BrowserWindow({
      show: false,
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    scraperWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await scraperWindow.loadURL('https://hakaimarket.com/');

    const startTime = Date.now();
    let result = null;

    while (Date.now() - startTime < 8000) {
      await new Promise(r => setTimeout(r, 600));
      if (!scraperWindow || scraperWindow.isDestroyed()) break;
      result = await scraperWindow.webContents.executeJavaScript(`
        (() => {
          const chips = Array.from(document.querySelectorAll('.diw-world-chip')).map(el => el.textContent.trim()).filter(Boolean);
          const card = Array.from(document.querySelectorAll('.diw-card')).find(c => c.innerText && c.innerText.includes('Yasir'));
          if (chips.length > 0 || card) {
            return {
              chips,
              cardFound: true
            };
          }
          return null;
        })()
      `).catch(() => null);

      if (result) break;
    }

    if (scraperWindow && !scraperWindow.isDestroyed()) {
      scraperWindow.destroy();
      scraperWindow = null;
    }

    const activeWorlds = (result && Array.isArray(result.chips)) ? result.chips : [];
    cachedHakaiResult = {
      success: true,
      activeWorlds,
      timestamp: new Date().toISOString()
    };
    lastHakaiCheck = now;

    const normalizedTarget = targetWorld.toLowerCase();
    const isActiveInTarget = activeWorlds.some(w => w.toLowerCase() === normalizedTarget);

    return {
      success: true,
      activeWorlds,
      targetWorld,
      isActiveInTarget,
      timestamp: cachedHakaiResult.timestamp
    };
  } catch (err) {
    if (scraperWindow && !scraperWindow.isDestroyed()) {
      scraperWindow.destroy();
    }
    const fallbackActiveWorlds = cachedHakaiResult ? cachedHakaiResult.activeWorlds : [];
    const normalizedTarget = targetWorld.toLowerCase();
    return {
      success: false,
      error: err.message,
      activeWorlds: fallbackActiveWorlds,
      targetWorld,
      isActiveInTarget: fallbackActiveWorlds.some(w => w.toLowerCase() === normalizedTarget),
      timestamp: new Date().toISOString()
    };
  }
});

// ==========================================
// CONFIGURACIÓN DE ACTUALIZACIONES (GITHUB)
// ==========================================
function sendUpdaterStatus(eventName, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('updater-event', { event: eventName, ...data });
  }
}

function initAutoUpdater() {
  if (!app.isPackaged) return;

  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableDifferentialDownload = true;

    autoUpdater.on('checking-for-update', () => {
      sendUpdaterStatus('checking');
    });

    autoUpdater.on('update-available', (info) => {
      sendUpdaterStatus('available', { version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
      sendUpdaterStatus('not-available', { version: info ? info.version : app.getVersion() });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      sendUpdaterStatus('progress', {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      sendUpdaterStatus('downloaded', { version: info.version });
    });

    autoUpdater.on('error', (err) => {
      sendUpdaterStatus('error', { message: err ? (err.message || err.toString()) : 'Error desconocido' });
    });

    // 1. Verificación inicial rápida apenas abre (a los 2 segundos)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((e) => {
        console.warn('Verificación inicial de actualización fallida:', e.message);
      });
    }, 2000);

    // 2. Detección en vivo continua cada 60 segundos (1 minuto) en segundo plano
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((e) => {
        console.warn('Verificación periódica de actualización fallida:', e.message);
      });
    }, 60000);

  } catch (err) {
    console.warn('No se pudo inicializar autoUpdater:', err);
  }
}

// Comprobación manual a petición del usuario desde el botón de la interfaz
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { success: false, dev: true, message: 'Modo desarrollo (ejecutado con npm start). Las actualizaciones automáticas funcionan en la app empaquetada.' };
  }
  try {
    const { autoUpdater } = require('electron-updater');
    const result = await autoUpdater.checkForUpdates();
    return { success: true, version: result && result.updateInfo ? result.updateInfo.version : null };
  } catch (err) {
    console.error('Error al comprobar actualizaciones manualmente:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('restart-and-update', () => {
  try {
    const { autoUpdater } = require('electron-updater');
    console.log('restart-and-update solicitado. Ejecutando quitAndInstall(false, true)...');
    // isSilent: false permite que Windows complete la instalación limpiamente y sin bloqueos de elevación
    // isForceRunAfter: true reinicia la app automáticamente tras la instalación
    autoUpdater.quitAndInstall(false, true);
    return true;
  } catch (err) {
    console.error('Error al aplicar actualización:', err);
    return false;
  }
});

app.whenReady().then(() => {
  if (session && session.defaultSession) {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      if (details.url.includes('wikia.nocookie.net') || details.url.includes('fandom.com')) {
        delete details.requestHeaders['Referer'];
        delete details.requestHeaders['referer'];
      }
      callback({ requestHeaders: details.requestHeaders });
    });
  }
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
