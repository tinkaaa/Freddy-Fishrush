const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  // Cargar lista de NPCs desde npcs_data.json
  loadNpcs: () => ipcRenderer.invoke('get-npcs'),
  // Guardar lista de NPCs en npcs_data.json dentro de la carpeta del programa
  saveNpcs: (npcs) => ipcRenderer.invoke('save-npcs', npcs),
  // Cargar lista de Imbuements desde imbuements_data.json
  loadImbuements: () => ipcRenderer.invoke('get-imbuements'),
  // Cargar lista de Drops de Monstruos desde creature_drops_data.json
  loadCreatureDrops: () => ipcRenderer.invoke('get-creature-drops'),
  // Cargar sprites de Monstruos desde monster_sprites.json
  loadMonsterSprites: () => ipcRenderer.invoke('get-monster-sprites'),
  // Cargar base de datos completa de Monstruos desde monsters_data.json
  loadMonstersData: () => ipcRenderer.invoke('get-monsters-data'),
  // Obtener ruta del archivo de datos
  getDataFilePath: () => ipcRenderer.invoke('get-data-path'),
  // Abrir la carpeta del programa en el Explorador de Windows
  openProgramFolder: () => ipcRenderer.invoke('open-program-folder'),
  // Scraping directo en el proceso principal de Node (sin CORS)
  scrapeDirect: (targetUrl) => ipcRenderer.invoke('scrape-web', targetUrl),
  // Abrir enlaces externos en el navegador por defecto
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  // Consultar estado en vivo de Yasir en Hakai Market
  checkYasirStatus: (opts) => ipcRenderer.invoke('check-yasir-status', opts),
  // Escuchar eventos del actualizador automático
  onUpdaterEvent: (callback) => {
    ipcRenderer.on('updater-event', (event, data) => callback(data));
  },
  // Comprobar manualmente actualizaciones desde GitHub en cualquier momento
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  // Aplicar actualización silenciosa sin ventanas de instalador
  applyUpdateNow: () => ipcRenderer.invoke('restart-and-update')
});
