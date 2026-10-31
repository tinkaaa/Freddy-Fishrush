/**
 * TIBIA NPC TRACKER & SCRAPER - CORE APPLICATION LOGIC
 */

// Aplicar fondo guardado de inmediato al cargar el documento
(function() {
  try {
    let savedId = localStorage.getItem('tibia_tracker_wallpaper') || 'aurora-estanque';
    if (savedId === 'default') savedId = 'barco-pesquero';
    const map = {
      'aurora-estanque': 'wallpapers/wallpaper-aurora-estanque.jpg',
      'picos-nocturnos': 'wallpapers/wallpaper-picos-nocturnos.jpg',
      'atardecer-rosa': 'wallpapers/wallpaper-atardecer-rosa.jpg',
      'aurora-purpura': 'wallpapers/wallpaper-aurora-purpura.jpg',
      'glaciar-turquesa': 'wallpapers/wallpaper-glaciar-turquesa.jpg',
      'barco-pesquero': 'wallpapers/wallpaper-barco-pesquero.jpg'
    };
    const imgUrl = map[savedId] || map['aurora-estanque'];
    const applyBg = () => {
      if (document.body) {
        document.body.style.backgroundImage = `linear-gradient(180deg, rgba(7, 11, 18, 0.72) 0%, rgba(9, 14, 23, 0.85) 100%), url('${imgUrl}')`;
      }
    };
    if (document.body) applyBg();
    else document.addEventListener('DOMContentLoaded', applyBg);
  } catch (e) {}
})();

// Estado global de la aplicación
const AppState = {
  // Base de datos de NPCs (inicia vacía como se solicitó)
  npcs: [],
  selectedNpcId: null,
  activeItemTab: 'sells', // 'sells' o 'buys'
  searchQuery: '',
  searchMode: 'all', // 'all' | 'buys' | 'sells'
  cityFilter: '',
  itemSearchQuery: '',
  itemSortField: null, // 'name' | 'price' | null
  itemSortOrder: 'asc', // 'asc' | 'desc'
  tempScrapedNpc: null,
  rashidSelectedDay: null, // null = día actual de Tibia (automático por Server Save)
  yasir: {
    selectedPort: localStorage.getItem('yasir_selected_port') || 'Carlin'
  },
  // Navegación de vistas principales ('npcs' | 'imbuements' | 'monsters')
  currentView: 'npcs',
  // Base de datos de Imbuements oficiales
  imbuements: [],
  creatureDrops: typeof CREATURE_DROPS_DATA !== 'undefined' ? CREATURE_DROPS_DATA : {},
  monsterSprites: typeof MONSTER_SPRITES_DATA !== 'undefined' ? MONSTER_SPRITES_DATA : (typeof MONSTER_SPRITES !== 'undefined' ? MONSTER_SPRITES : {}),
  // Base de datos completa de Monstruos & Bestiario
  monsters: typeof MONSTERS_DATA !== 'undefined' ? MONSTERS_DATA : {},
  monsterFilter: {
    query: '',
    boss: 'all',
    sort: 'name-asc'
  },
  imbuFilter: {
    query: '',
    category: 'all',
    tier: 'all'
  },
  expandedImbuements: new Set(),
  minimizedCategories: new Set([
    'Protective Imbuements',
    'Support Imbuements',
    'Skill Improving Imbuements',
    'Attack Imbuements'
  ])
};
// Limpiar cualquier residuo de mundo en almacenamiento
try { localStorage.removeItem('yasir_target_world'); } catch (e) {}

// ==========================================
// ITINERARIO SEMANAL DINÁMICO DE RASHID
// ==========================================
const RASHID_SCHEDULE = {
  1: {
    dayIndex: 1,
    dayName: 'Lunes',
    dayShort: 'Lun',
    city: 'Svargrond',
    tavern: 'Taberna de Dankwart',
    location: 'En la taberna de Dankwart, al sur del barco (+1 piso).',
    coords: { x: '32210', y: '31158', z: '7' },
    mapUrl: 'https://tibiamaps.io/map#32210,31158,7:2'
  },
  2: {
    dayIndex: 2,
    dayName: 'Martes',
    dayShort: 'Mar',
    city: 'Liberty Bay',
    tavern: 'Taberna de Lyonel',
    location: 'En la taberna al oeste del depot (+1 piso).',
    coords: { x: '32303', y: '32838', z: '7' },
    mapUrl: 'https://tibiamaps.io/map#32303,32838,7:2'
  },
  3: {
    dayIndex: 3,
    dayName: 'Miércoles',
    dayShort: 'Mié',
    city: 'Port Hope',
    tavern: 'Taberna de Clyde',
    location: 'Cerca del barco, subiendo a la plataforma de madera sobre el agua.',
    coords: { x: '32579', y: '32754', z: '7' },
    mapUrl: 'https://tibiamaps.io/map#32579,32754,7:2'
  },
  4: {
    dayIndex: 4,
    dayName: 'Jueves',
    dayShort: 'Jue',
    city: 'Ankrahmun',
    tavern: 'Taberna de Arito',
    location: 'En la taberna del oasis / bazar, sobre la tienda de Arito (+1 piso).',
    coords: { x: '33067', y: '32879', z: '6' },
    mapUrl: 'https://tibiamaps.io/map#33067,32879,6:2'
  },
  5: {
    dayIndex: 5,
    dayName: 'Viernes',
    dayShort: 'Vie',
    city: 'Darashia',
    tavern: 'Taberna de Miraia',
    location: 'En la taberna de Miraia, al oeste del depot.',
    coords: { x: '33233', y: '32480', z: '7' },
    mapUrl: 'https://tibiamaps.io/map#33233,32480,7:2'
  },
  6: {
    dayIndex: 6,
    dayName: 'Sábado',
    dayShort: 'Sáb',
    city: 'Edron',
    tavern: 'Taberna de Mirabell',
    location: 'En la taberna de Mirabell, sobre la tienda de magia (+1 piso).',
    coords: { x: '33171', y: '31808', z: '6' },
    mapUrl: 'https://tibiamaps.io/map#33171,31808,6:2'
  },
  0: {
    dayIndex: 0,
    dayName: 'Domingo',
    dayShort: 'Dom',
    city: 'Carlin',
    tavern: 'Taberna de William',
    location: 'En la taberna de William, sobre el depot (+1 piso).',
    coords: { x: '32327', y: '31782', z: '6' },
    mapUrl: 'https://tibiamaps.io/map#32327,31782,6:2'
  }
};

function isRashidNpc(npc) {
  if (!npc || !npc.name) return false;
  return npc.name.trim().toLowerCase() === 'rashid';
}

function getTibiaServerSaveDayIndex() {
  const now = new Date();
  // Server save de Tibia es a las 10:00 CEST (aprox 08:00 UTC)
  const tibiaDate = new Date(now.getTime() - (8 * 60 * 60 * 1000));
  return tibiaDate.getUTCDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
}

function getRashidActiveSchedule(selectedDay = null) {
  const currentTibiaDay = getTibiaServerSaveDayIndex();
  const dayIndex = (selectedDay !== null && selectedDay !== undefined) ? Number(selectedDay) : currentTibiaDay;
  return {
    todayIndex: currentTibiaDay,
    activeDayIndex: dayIndex,
    isToday: dayIndex === currentTibiaDay,
    schedule: RASHID_SCHEDULE[dayIndex] || RASHID_SCHEDULE[currentTibiaDay]
  };
}

// ==========================================
// PUERTOS Y DETECTOR EN VIVO DE YASIR
// ==========================================
const YASIR_PORTS = {
  Carlin: {
    name: 'Carlin',
    city: 'Carlin',
    location: 'En su barco atracado en los muelles al sur de Carlin (+1 piso sobre el muelle).',
    coordinates: { x: '32398', y: '31815', z: '6' },
    mapUrl: 'https://tibiamaps.io/map#32398,31815,6:2',
    desc: 'Muelles del sur de Carlin'
  },
  Ankrahmun: {
    name: 'Ankrahmun',
    city: 'Ankrahmun',
    location: 'En su barco atracado en el muelle este de Ankrahmun.',
    coordinates: { x: '33092', y: '32882', z: '6' },
    mapUrl: 'https://tibiamaps.io/map#33092,32882,6:2',
    desc: 'Muelle este del oasis'
  },
  'Liberty Bay': {
    name: 'Liberty Bay',
    city: 'Liberty Bay',
    location: 'En su barco atracado en los muelles de Liberty Bay.',
    coordinates: { x: '32314', y: '32860', z: '6' },
    mapUrl: 'https://tibiamaps.io/map#32314,32860,6:2',
    desc: 'Muelles al sur de Liberty Bay'
  }
};

function isYasirNpc(npc) {
  if (!npc || !npc.name) return false;
  return npc.name.trim().toLowerCase() === 'yasir';
}

function getCachedYasirInfo() {
  const portKey = AppState.yasir?.selectedPort || 'Carlin';
  const port = YASIR_PORTS[portKey] || YASIR_PORTS.Carlin;
  return {
    portKey,
    port
  };
}


// Clave en LocalStorage
const STORAGE_KEY = 'tibia_npc_tracker_db_v1';

// Icono SVG por defecto para avatar si no hay imagen
const DEFAULT_AVATAR_SVG = `
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e5b93b" stroke-width="1.5">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
  <circle cx="12" cy="7" r="4"></circle>
</svg>
`;

// Icono SVG por defecto para items
const DEFAULT_ITEM_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
  <polyline points="2 17 12 22 22 17"></polyline>
  <polyline points="2 12 12 17 22 12"></polyline>
</svg>
`;

// Manejadores seguros de error para imágenes
function handleItemImageError(img) {
  if (!img) return;
  if (!img.dataset.retried) {
    img.dataset.retried = '1';
    const originalSrc = img.getAttribute('data-src') || img.src;
    img.src = '/api/image?url=' + encodeURIComponent(originalSrc);
  } else {
    img.onerror = null;
    img.style.display = 'none';
    if (img.parentElement && !img.parentElement.querySelector('svg')) {
      img.parentElement.insertAdjacentHTML('beforeend', DEFAULT_ITEM_SVG);
    }
  }
}

function handleAvatarImageError(img) {
  if (!img) return;
  if (!img.dataset.retried) {
    img.dataset.retried = '1';
    const originalSrc = img.getAttribute('data-src') || img.src;
    img.src = '/api/image?url=' + encodeURIComponent(originalSrc);
  } else {
    img.onerror = null;
    img.style.display = 'none';
    if (img.parentElement && !img.parentElement.querySelector('svg')) {
      img.parentElement.insertAdjacentHTML('beforeend', DEFAULT_AVATAR_SVG);
    }
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  initWallpaperManager();
  initInAppUpdaterUI();
  initChangelogUI();
  initEventListeners();
  await loadFromStorage();
  await loadImbuementsFromStorage();
  initImbuementsUI();
  await loadMonstersFromStorage();
  initMonstersUI();
  updateCityFilterOptions();
  renderApp();
  updateNavBadges();
});

// Cargar datos: primero desde desktopAPI (Electron), luego /api/get-npcs (Web/Navegador), y finalmente fallback a LocalStorage
async function loadFromStorage() {
  let loaded = false;

  // 1. Entorno de Escritorio Electron
  if (window.desktopAPI && window.desktopAPI.loadNpcs) {
    try {
      const desktopData = await window.desktopAPI.loadNpcs();
      if (Array.isArray(desktopData) && desktopData.length > 0) {
        AppState.npcs = desktopData;
        loaded = true;
      }
    } catch (e) {
      console.warn('Error cargando desde desktopAPI:', e);
    }
  }

  // 2. Entorno Web: cargar directamente desde el archivo npcs_data.json del servidor
  if (!loaded) {
    try {
      const res = await fetch('/api/get-npcs', { cache: 'no-cache' });
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData) && serverData.length > 0) {
          AppState.npcs = serverData;
          loaded = true;
        }
      }
    } catch (e) {
      try {
        const resStatic = await fetch('/npcs_data.json', { cache: 'no-cache' });
        if (resStatic.ok) {
          const staticData = await resStatic.json();
          if (Array.isArray(staticData) && staticData.length > 0) {
            AppState.npcs = staticData;
            loaded = true;
          }
        }
      } catch (err) {}
    }
  }

  // 3. Fallback a LocalStorage
  if (!loaded) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          AppState.npcs = parsed;
          loaded = true;
        }
      }
    } catch (e) {
      console.error('Error al leer de LocalStorage:', e);
      AppState.npcs = [];
    }
  }

  // Sanitizar y autorreparar cualquier item con imagen corrupta, placeholder o falta de path-prefix
  const repaired = sanitizeAndRepairNpcData(AppState.npcs);
  if (repaired) {
    await saveToStorage();
  }

  if (AppState.npcs.length > 0 && !AppState.selectedNpcId) {
    AppState.selectedNpcId = AppState.npcs[0].id;
  }
}

// Sanitizar y autorreparar URLs de imágenes de items y NPCs en caso de datos antiguos
function sanitizeAndRepairNpcData(npcs) {
  if (!Array.isArray(npcs)) return false;
  let modified = false;

  npcs.forEach(npc => {
    // Si la imagen del NPC era un globo de diálogo o base64, limpiarla
    if (npc.imageUrl) {
      if (npc.imageUrl.startsWith('data:image') || npc.imageUrl.includes('NPC_Bubble_')) {
        npc.imageUrl = '';
        modified = true;
      } else if (npc.imageUrl.includes('wikia.nocookie.net') && !npc.imageUrl.includes('path-prefix=')) {
        npc.imageUrl += (npc.imageUrl.includes('?') ? '&' : '?') + 'path-prefix=en';
        modified = true;
      }
    }

    // Asignar sprite oficial de Tibia Wiki al NPC si no tiene imagen
    if (!npc.imageUrl && npc.name && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
      npc.imageUrl = TibiaScraper.getFandomItemIconUrl(npc.name);
      modified = true;
    }

    // Asegurar que cada NPC tenga su enlace oficial a Tibia Wiki
    if (!npc.sourceUrl && npc.name) {
      npc.sourceUrl = `https://tibia.fandom.com/wiki/${encodeURIComponent(npc.name.trim().replace(/\s+/g, '_'))}`;
      modified = true;
    }

    // Asegurar que Yasir tenga por defecto sus 3 ciudades si tenía solo Carlin o ninguna
    if (isYasirNpc(npc)) {
      if (!npc.city || npc.city.trim().toLowerCase() === 'carlin') {
        npc.city = 'Carlin, Ankrahmun, Liberty Bay';
        npc.location = 'Muelles al sur de Carlin / Muelle este de Ankrahmun / Muelles de Liberty Bay';
        modified = true;
      }
    }

    const repairItem = (item) => {
      let icon = item.icon || '';
      if (!icon || icon.startsWith('data:image')) {
        if (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
          item.icon = TibiaScraper.getFandomItemIconUrl(item.name);
          modified = true;
        }
      } else if (icon.includes('wikia.nocookie.net') || icon.includes('fandom.com')) {
        let changed = false;
        if (!icon.includes('/revision/')) {
          const qIdx = icon.indexOf('?');
          icon = (qIdx !== -1 ? icon.slice(0, qIdx) : icon) + '/revision/latest?path-prefix=en';
          changed = true;
        } else if (!icon.includes('path-prefix=')) {
          icon += (icon.includes('?') ? '&' : '?') + 'path-prefix=en';
          changed = true;
        }
        if (changed) {
          item.icon = icon;
          modified = true;
        }
      }
    };

    // Limpiar items que sean transcripciones de diálogo accidentales de la wiki
    const isRealItem = (item) => {
      if (!item || !item.name) return false;
      const name = item.name.trim();
      if (name.length > 60) return false;
      if (name.includes('Player:') || name.includes('Transcript') || name.includes('Dialogue') || name.includes('<end of conversation>') || name.includes('Farewell')) return false;
      if (/^[A-Z][a-z]+:\s/.test(name)) return false;
      return true;
    };

    if (Array.isArray(npc.itemsSells)) {
      const origLen = npc.itemsSells.length;
      npc.itemsSells = npc.itemsSells.filter(isRealItem);
      if (npc.itemsSells.length !== origLen) modified = true;
      npc.itemsSells.forEach(repairItem);
    }
    if (Array.isArray(npc.itemsBuys)) {
      const origLen = npc.itemsBuys.length;
      npc.itemsBuys = npc.itemsBuys.filter(isRealItem);
      if (npc.itemsBuys.length !== origLen) modified = true;
      npc.itemsBuys.forEach(repairItem);
    }
  });

  return modified;
}

// Guardar datos: persiste en npcs_data.json dentro de la carpeta del programa
async function saveToStorage() {
  // 1. Guardar en archivo local del programa (Electron)
  if (window.desktopAPI && window.desktopAPI.saveNpcs) {
    try {
      await window.desktopAPI.saveNpcs(AppState.npcs);
    } catch (e) {
      console.error('Error guardando en npcs_data.json:', e);
    }
  } else {
    // 2. Guardar vía endpoint HTTP de servidor local si estamos en navegador
    try {
      await fetch('/api/save-npcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(AppState.npcs)
      });
    } catch (e) {
      // ignore
    }
  }

  // 3. Respaldo en LocalStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.npcs));
  } catch (e) {
    console.error('Error al guardar en LocalStorage:', e);
  }
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function initEventListeners() {
  // Búsqueda y Filtros
  const searchInput = document.getElementById('search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');

  function updateClearSearchVisibility() {
    if (btnClearSearch && searchInput) {
      btnClearSearch.style.display = searchInput.value.trim().length > 0 ? 'flex' : 'none';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value.toLowerCase().trim();
      updateClearSearchVisibility();
      renderApp();
    });
    updateClearSearchVisibility();
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', (e) => {
      e.stopPropagation();
      if (searchInput) {
        searchInput.value = '';
        AppState.searchQuery = '';
        updateClearSearchVisibility();
        const dropdown = document.getElementById('search-suggestions-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        searchInput.focus();
        renderApp();
      }
    });
  }

  const searchIcon = document.querySelector('.search-icon');
  if (searchIcon) {
    searchIcon.setAttribute('title', 'Buscar o presionar Enter');
    searchIcon.addEventListener('click', () => {
      if (typeof executeMainSearch === 'function') {
        executeMainSearch();
      }
    });
  }

  // Inicializar autocompletado y sugerencias desplegables con sprites
  initSearchAutocomplete();

  // Modos de Búsqueda (Todo | ¿Quién lo Compra? | ¿Quién lo Vende?)
  const modeButtons = document.querySelectorAll('.btn-mode-tab');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      AppState.searchMode = mode;
      modeButtons.forEach(b => b.classList.toggle('active', b === btn));

      if (searchInput) {
        if (mode === 'buys') {
          searchInput.placeholder = 'Escribe el nombre del item que deseas vender (ej: Dragon Necklace, Crystal Ball)...';
        } else if (mode === 'sells') {
          searchInput.placeholder = 'Escribe el nombre del item que buscas comprar (ej: Rope, Shovel)...';
        } else {
          searchInput.placeholder = 'Buscar qué NPC compra un item (ej: Dragon Necklace), o por nombre/ciudad...';
        }
        searchInput.focus();
      }

      renderApp();
    });
  });

  const filterCity = document.getElementById('filter-city');
  const btnClearCity = document.getElementById('btn-clear-city');

  window.updateClearCityVisibility = function() {
    const fCity = document.getElementById('filter-city');
    const bClear = document.getElementById('btn-clear-city');
    const wrapper = fCity ? fCity.closest('.city-filter-wrapper') : null;
    if (fCity) {
      const hasVal = Boolean(fCity.value);
      if (bClear) {
        bClear.style.display = hasVal ? 'flex' : 'none';
      }
      if (wrapper) {
        wrapper.classList.toggle('has-value', hasVal);
      }
    }
  };

  if (filterCity) {
    filterCity.addEventListener('change', (e) => {
      AppState.cityFilter = e.target.value.toLowerCase().trim();
      window.updateClearCityVisibility();
      renderApp();
    });
    window.updateClearCityVisibility();
  }

  if (btnClearCity) {
    btnClearCity.addEventListener('click', (e) => {
      e.stopPropagation();
      if (filterCity) {
        filterCity.value = '';
        AppState.cityFilter = '';
        window.updateClearCityVisibility();
        renderApp();
      }
    });
  }

  // Botones de Cabecera y Herramientas
  const btnOpenScraper = document.getElementById('btn-open-scraper');
  if (btnOpenScraper) {
    btnOpenScraper.addEventListener('click', () => {
      openModal('modal-scraper');
    });
  }

  const btnOpenScraperFromBackup = document.getElementById('btn-open-scraper-from-backup');
  if (btnOpenScraperFromBackup) {
    btnOpenScraperFromBackup.addEventListener('click', () => {
      closeModal('modal-backup');
      openModal('modal-scraper');
    });
  }

  const btnOpenManual = document.getElementById('btn-open-manual');
  if (btnOpenManual) {
    btnOpenManual.addEventListener('click', () => {
      openNpcFormModal(null);
    });
  }

  document.getElementById('btn-open-backup').addEventListener('click', () => {
    updateStatsBadge();
    openModal('modal-backup');
  });

  const btnOpenWallpapers = document.getElementById('btn-open-wallpapers');
  if (btnOpenWallpapers) {
    btnOpenWallpapers.addEventListener('click', () => {
      closeModal('modal-backup');
      openModal('modal-wallpapers');
    });
  }





  // Cerrar modales (botones data-close y clicks de fondo)
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      closeModal(modalId);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
  });

  // Enlaces externos en la app de escritorio
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[target="_blank"]');
    if (link && window.desktopAPI && window.desktopAPI.openExternalUrl) {
      e.preventDefault();
      window.desktopAPI.openExternalUrl(link.href);
    }
  });

  // Ejecutar Scraping por URL
  document.getElementById('btn-run-scrape').addEventListener('click', handleRunScrape);
  document.getElementById('scraper-input-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRunScrape();
  });

  // Guardar NPC raspado
  document.getElementById('btn-save-scraped').addEventListener('click', handleSaveScrapedNpc);

  // Formulario Manual (Crear / Editar)
  document.getElementById('btn-save-npc-form').addEventListener('click', handleSaveNpcForm);

  // Copias de Seguridad (Exportar / Importar / Demo / Limpiar)
  document.getElementById('btn-export-json').addEventListener('click', exportDatabaseToJson);
  document.getElementById('file-import-json').addEventListener('change', importDatabaseFromJson);
  const btnLoadSample = document.getElementById('btn-load-sample');
  if (btnLoadSample) {
    btnLoadSample.addEventListener('click', loadSampleDemoData);
  }
  document.getElementById('btn-clear-all').addEventListener('click', clearEntireDatabase);

  // Ver Lista Completa de NPCs Registrados
  const btnOpenAllNpcs = document.getElementById('btn-open-all-npcs-modal');
  if (btnOpenAllNpcs) {
    btnOpenAllNpcs.addEventListener('click', openAllNpcsModal);
  }

  const rowViewAllNpcs = document.getElementById('row-view-all-npcs');
  if (rowViewAllNpcs) {
    rowViewAllNpcs.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-open-all-npcs-modal')) {
        openAllNpcsModal();
      }
    });
  }

  const allNpcsFilterInput = document.getElementById('all-npcs-filter-input');
  if (allNpcsFilterInput) {
    allNpcsFilterInput.addEventListener('input', (e) => {
      renderAllNpcsGrid(e.target.value);
    });
  }

  const btnBackToAllNpcs = document.getElementById('btn-back-to-all-npcs');
  if (btnBackToAllNpcs) {
    btnBackToAllNpcs.addEventListener('click', closeNpcQuickPreview);
  }

  // Sincronización Masiva desde TibiaWiki
  const btnBatch = document.getElementById('btn-batch-update');
  if (btnBatch) {
    btnBatch.addEventListener('click', openBatchUpdateModal);
  }

  const btnBatchFromBackup = document.getElementById('btn-open-batch-from-backup');
  if (btnBatchFromBackup) {
    btnBatchFromBackup.addEventListener('click', () => {
      closeModal('modal-backup');
      openBatchUpdateModal();
    });
  }

  const btnStartBatch = document.getElementById('btn-start-batch-update');
  if (btnStartBatch) {
    btnStartBatch.addEventListener('click', startBatchUpdate);
  }

  const btnCancelBatch = document.getElementById('btn-cancel-batch');
  if (btnCancelBatch) {
    btnCancelBatch.addEventListener('click', () => {
      cancelBatchRequested = true;
      btnCancelBatch.textContent = '⏳ Deteniendo...';
      btnCancelBatch.disabled = true;
    });
  }

  // Modal de Actualización de Monstruos & Bosses
  const btnOpenMonsterUpdater = document.getElementById('btn-open-monster-updater');
  if (btnOpenMonsterUpdater) {
    btnOpenMonsterUpdater.addEventListener('click', openMonsterUpdaterModal);
  }

  // Actualizar todo de golpe directamente desde el header o el banner
  const btnUpdateAllMonstersNow = document.getElementById('btn-update-all-monsters-now');
  if (btnUpdateAllMonstersNow) {
    btnUpdateAllMonstersNow.addEventListener('click', startFullMonsterUpdateInstantly);
  }

  const btnQuickUpdateMonstersBanner = document.getElementById('btn-quick-update-monsters-banner');
  if (btnQuickUpdateMonstersBanner) {
    btnQuickUpdateMonstersBanner.addEventListener('click', () => {
      const radio = document.querySelector('input[name="monster-update-scope"][value="monsters"]');
      if (radio) {
        radio.checked = true;
        document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
        document.getElementById('card-scope-monsters')?.classList.add('active');
      }
      startMonsterUpdate();
    });
  }

  const btnQuickUpdateBossesBanner = document.getElementById('btn-quick-update-bosses-banner');
  if (btnQuickUpdateBossesBanner) {
    btnQuickUpdateBossesBanner.addEventListener('click', () => {
      const radio = document.querySelector('input[name="monster-update-scope"][value="bosses"]');
      if (radio) {
        radio.checked = true;
        document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
        document.getElementById('card-scope-bosses')?.classList.add('active');
      }
      startMonsterUpdate();
    });
  }

  const btnQuickUpdateAllBanner = document.getElementById('btn-quick-update-all-banner');
  if (btnQuickUpdateAllBanner) {
    btnQuickUpdateAllBanner.addEventListener('click', () => {
      const radioAll = document.querySelector('input[name="monster-update-scope"][value="all"]');
      if (radioAll) {
        radioAll.checked = true;
        document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
        document.getElementById('card-scope-all')?.classList.add('active');
      }
      startMonsterUpdate();
    });
  }

  const btnOpenMonsterUpdaterFromBackup = document.getElementById('btn-open-monster-updater-from-backup');
  if (btnOpenMonsterUpdaterFromBackup) {
    btnOpenMonsterUpdaterFromBackup.addEventListener('click', () => {
      closeModal('modal-backup');
      openMonsterUpdaterModal();
    });
  }

  const btnUpdateOnlyMonstersBackup = document.getElementById('btn-update-only-monsters-backup');
  if (btnUpdateOnlyMonstersBackup) {
    btnUpdateOnlyMonstersBackup.addEventListener('click', () => {
      closeModal('modal-backup');
      startRegularMonstersUpdateInstantly();
    });
  }

  const btnUpdateOnlyBossesBackup = document.getElementById('btn-update-only-bosses-backup');
  if (btnUpdateOnlyBossesBackup) {
    btnUpdateOnlyBossesBackup.addEventListener('click', () => {
      closeModal('modal-backup');
      startBossesUpdateInstantly();
    });
  }

  const btnUpdateAllMonstersBackup = document.getElementById('btn-update-all-monsters-backup');
  if (btnUpdateAllMonstersBackup) {
    btnUpdateAllMonstersBackup.addEventListener('click', () => {
      closeModal('modal-backup');
      startFullMonsterUpdateInstantly();
    });
  }

  const btnStartMonsterUpdate = document.getElementById('btn-start-monster-update');
  if (btnStartMonsterUpdate) {
    btnStartMonsterUpdate.addEventListener('click', startMonsterUpdate);
  }

  const btnCancelMonsterUpdate = document.getElementById('btn-cancel-monster-update');
  if (btnCancelMonsterUpdate) {
    btnCancelMonsterUpdate.addEventListener('click', () => {
      cancelMonsterUpdateRequested = true;
      btnCancelMonsterUpdate.textContent = '⏳ Deteniendo...';
      btnCancelMonsterUpdate.disabled = true;
    });
  }

  // Modal de Eliminación con Captcha
  const btnRefreshCaptcha = document.getElementById('btn-refresh-captcha');
  if (btnRefreshCaptcha) {
    btnRefreshCaptcha.addEventListener('click', () => {
      currentCaptchaCode = generateCaptchaCode(5);
      drawCaptcha(currentCaptchaCode);
      const input = document.getElementById('delete-captcha-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      const errorEl = document.getElementById('delete-captcha-error');
      if (errorEl) errorEl.style.display = 'none';
    });
  }

  const canvasCaptcha = document.getElementById('delete-captcha-canvas');
  if (canvasCaptcha) {
    canvasCaptcha.addEventListener('click', () => {
      currentCaptchaCode = generateCaptchaCode(5);
      drawCaptcha(currentCaptchaCode);
      const input = document.getElementById('delete-captcha-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    });
  }

  const btnConfirmDelete = document.getElementById('btn-confirm-delete-with-captcha');
  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener('click', handleConfirmDeleteWithCaptcha);
  }

  const inputCaptcha = document.getElementById('delete-captcha-input');
  if (inputCaptcha) {
    inputCaptcha.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmDeleteWithCaptcha();
      }
    });
  }

  // Modal de Vaciar Base de Datos con Captcha
  const btnRefreshClearDb = document.getElementById('btn-refresh-clear-db-captcha');
  if (btnRefreshClearDb) {
    btnRefreshClearDb.addEventListener('click', () => {
      currentClearDbCaptchaCode = generateCaptchaCode(5);
      drawCaptcha(currentClearDbCaptchaCode, 'clear-db-captcha-canvas');
      const input = document.getElementById('clear-db-captcha-input');
      if (input) {
        input.value = '';
        input.focus();
      }
      const errorEl = document.getElementById('clear-db-captcha-error');
      if (errorEl) errorEl.style.display = 'none';
    });
  }

  const canvasClearDb = document.getElementById('clear-db-captcha-canvas');
  if (canvasClearDb) {
    canvasClearDb.addEventListener('click', () => {
      currentClearDbCaptchaCode = generateCaptchaCode(5);
      drawCaptcha(currentClearDbCaptchaCode, 'clear-db-captcha-canvas');
      const input = document.getElementById('clear-db-captcha-input');
      if (input) {
        input.value = '';
        input.focus();
      }
    });
  }

  const btnConfirmClearDb = document.getElementById('btn-confirm-clear-db-with-captcha');
  if (btnConfirmClearDb) {
    btnConfirmClearDb.addEventListener('click', handleConfirmClearDbWithCaptcha);
  }

  const inputClearDb = document.getElementById('clear-db-captcha-input');
  if (inputClearDb) {
    inputClearDb.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmClearDbWithCaptcha();
      }
    });
  }

  // Modal de Editar Ubicación y Ciudades
  const btnSaveLocation = document.getElementById('btn-save-location');
  if (btnSaveLocation) {
    btnSaveLocation.addEventListener('click', handleSaveLocation);
  }

  const inputLocCities = document.getElementById('edit-loc-cities');
  if (inputLocCities) {
    inputLocCities.addEventListener('input', () => {
      renderCityChips();
    });
    inputLocCities.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveLocation();
      }
    });
  }

  const inputLocDesc = document.getElementById('edit-loc-desc');
  if (inputLocDesc) {
    inputLocDesc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveLocation();
      }
    });
  }

  // Añadir nueva ciudad manualmente
  const btnAddCustomCity = document.getElementById('btn-add-custom-city');
  if (btnAddCustomCity) {
    btnAddCustomCity.addEventListener('click', handleAddCustomCity);
  }

  const inputNewCustomCity = document.getElementById('input-new-custom-city');
  if (inputNewCustomCity) {
    inputNewCustomCity.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomCity();
      }
    });
  }
}

// ==========================================
// SISTEMA DE AUTOCOMPLETADO Y SUGERENCIAS DEL BUSCADOR
// ==========================================
let currentSuggestionSelectionIndex = -1;
let currentSuggestionsList = [];

function executeMainSearch(query) {
  const searchInput = document.getElementById('search-input');
  const rawQ = query !== undefined ? query : (searchInput ? searchInput.value : '');
  const q = (rawQ || '').trim();

  hideSearchSuggestions();

  AppState.searchQuery = q.toLowerCase();
  const btnClearSearch = document.getElementById('btn-clear-search');
  if (btnClearSearch) {
    btnClearSearch.style.display = q.length > 0 ? 'flex' : 'none';
  }

  // 0. Si coincide con una ciudad conocida por nombre exacto, filtrar directamente por esa ciudad
  const knownCities = typeof getAllCities === 'function' ? getAllCities() : [];
  const exactCity = knownCities.find(c => c.toLowerCase() === q.toLowerCase());
  if (exactCity) {
    selectSearchSuggestion({ type: 'city', name: exactCity });
    return;
  }

  // 1. Si coincide con un NPC por nombre exacto, seleccionarlo prioritariamente
  const exactNpc = AppState.npcs.find(n => (n.name || '').toLowerCase() === q.toLowerCase());
  if (exactNpc) {
    AppState.selectedNpcId = exactNpc.id;
  } else {
    // 2. Si coincide exactamente con un item en las sugerencias actuales, usar selectSearchSuggestion
    const exactSuggestion = currentSuggestionsList.find(s => (s.name || '').toLowerCase() === q.toLowerCase());
    if (exactSuggestion) {
      selectSearchSuggestion(exactSuggestion);
      return;
    }

    // 3. Si no hay coincidencia exacta, aplicar filtros y seleccionar el primer resultado
    const filtered = getFilteredNpcs();
    if (filtered.length > 0) {
      if (!filtered.some(n => n.id === AppState.selectedNpcId)) {
        AppState.selectedNpcId = filtered[0].id;
      }
    }
  }

  renderApp();

  // Scroll suave al NPC seleccionado en la columna izquierda
  if (AppState.selectedNpcId) {
    setTimeout(() => {
      const card = document.querySelector(`.npc-card[data-id="${AppState.selectedNpcId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);
  }
}

function initSearchAutocomplete() {
  const searchInput = document.getElementById('search-input');
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!searchInput || !dropdown) return;

  // Actualizar sugerencias en tiempo real
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (q.length >= 1) {
      renderSearchSuggestions(q);
    } else {
      hideSearchSuggestions();
    }
  });

  // Mostrar si el input ya tiene texto al hacer foco
  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    if (q.length >= 1) {
      renderSearchSuggestions(q);
    }
  });

  // Navegación por teclado (Flechas Arriba/Abajo, Enter, Escape)
  searchInput.addEventListener('keydown', (e) => {
    const isDropdownVisible = dropdown && dropdown.style.display !== 'none' && currentSuggestionsList.length > 0;

    if (e.key === 'ArrowDown') {
      if (!isDropdownVisible) return;
      e.preventDefault();
      currentSuggestionSelectionIndex = (currentSuggestionSelectionIndex + 1) % currentSuggestionsList.length;
      updateSuggestionSelectionHighlight();
    } else if (e.key === 'ArrowUp') {
      if (!isDropdownVisible) return;
      e.preventDefault();
      currentSuggestionSelectionIndex = (currentSuggestionSelectionIndex - 1 + currentSuggestionsList.length) % currentSuggestionsList.length;
      updateSuggestionSelectionHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isDropdownVisible && currentSuggestionSelectionIndex >= 0 && currentSuggestionSelectionIndex < currentSuggestionsList.length) {
        // Usuario seleccionó una sugerencia con las flechas
        selectSearchSuggestion(currentSuggestionsList[currentSuggestionSelectionIndex]);
      } else if (isDropdownVisible && currentSuggestionsList.length === 1) {
        // Hay una única sugerencia directa
        selectSearchSuggestion(currentSuggestionsList[0]);
      } else {
        // Ejecutar búsqueda directa con el texto actual del input
        executeMainSearch(searchInput.value);
      }
    } else if (e.key === 'Escape') {
      hideSearchSuggestions();
    }
  });

  // Cerrar al hacer clic fuera del buscador y del dropdown
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      hideSearchSuggestions();
    }
  });
}

function updateSuggestionSelectionHighlight() {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.suggestion-item');
  items.forEach((item, idx) => {
    if (idx === currentSuggestionSelectionIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

function hideSearchSuggestions() {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  currentSuggestionSelectionIndex = -1;
  currentSuggestionsList = [];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightMatch(text, query) {
  if (!text) return '';
  const escapedText = escapeHtml(text);
  if (!query) return escapedText;
  const cleanQ = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!cleanQ) return escapedText;
  const regex = new RegExp(`(^|[\\s,./\\-_()])(${cleanQ})`, 'gi');
  return escapedText.replace(regex, '$1<mark>$2</mark>');
}

// Comprobar coincidencia estricta por secuencia de inicio (prefijo directo o al inicio de una palabra)
function matchesPrefixSequence(targetText, query) {
  if (!targetText || !query) return false;
  const t = String(targetText).toLowerCase().trim();
  const q = String(query).toLowerCase().trim();
  if (!q) return true;

  // 1. Coincidencia directa al inicio de toda la frase (ej: "Edron" con "e", "Liberty Bay" con "lib")
  if (t.startsWith(q)) return true;

  const tNorm = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const qNorm = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (tNorm.startsWith(qNorm)) return true;

  // 2. Coincidencia al inicio de cualquiera de las palabras individuales
  // (ej: "Dragon Necklace" coincide con "d" o con "n", pero NO con "e" o "k")
  const words = t.split(/[\s,./\-_()]+/).filter(Boolean);
  const wordsNorm = tNorm.split(/[\s,./\-_()]+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q) || wordsNorm[i].startsWith(qNorm)) {
      return true;
    }
  }

  // 3. Coincidencia cuando el usuario escribe varias palabras separadas por espacio (ej: "dragon n")
  if (q.includes(' ')) {
    const qParts = q.split(/\s+/).filter(Boolean);
    if (qParts.length > 1) {
      let wIdx = 0;
      let matchedAll = true;
      for (const qPart of qParts) {
        let found = false;
        while (wIdx < words.length) {
          if (words[wIdx].startsWith(qPart) || wordsNorm[wIdx].startsWith(qPart)) {
            found = true;
            wIdx++;
            break;
          }
          wIdx++;
        }
        if (!found) {
          matchedAll = false;
          break;
        }
      }
      if (matchedAll) return true;
    }
  }

  return false;
}

// Comprobar coincidencia de un item (por prefijo de palabra o subcadena para términos compuestos)
function isItemMatch(item, query) {
  if (!item || !query) return false;
  const name = typeof item === 'string' ? item : (item.name || '');
  if (!name) return false;
  const q = String(query).trim().toLowerCase();
  if (!q) return true;
  const t = name.toLowerCase().trim();

  if (matchesPrefixSequence(t, q)) return true;

  // Si la consulta tiene al menos 3 caracteres, permitir también coincidencia por subcadena
  // para capturar nombres compuestos como "Soulfire Rune" o "Piece of Hellfire Armor" al buscar "fire"
  if (q.length >= 3) {
    const qNorm = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tNorm = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (t.includes(q) || tNorm.includes(qNorm)) return true;
  }

  return false;
}

function getSearchSuggestionsData(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return { cities: [], items: [], npcs: [] };
  const mode = AppState.searchMode || 'all';

  // 1. Buscar NPCs coincidentes por prefijo
  const npcMatches = [];
  AppState.npcs.forEach(npc => {
    const npcName = (npc.name || '').trim();
    const isMatchName = matchesPrefixSequence(npcName, q);
    const isYasir = isYasirNpc(npc);
    const isRashid = isRashidNpc(npc);

    let isMatchCity = false;
    if (isRashid) {
      const rCity = getRashidActiveSchedule().schedule.city;
      isMatchCity = matchesPrefixSequence(rCity, q);
    } else if (isYasir) {
      const rawCities = (npc.city || 'Carlin, Ankrahmun, Liberty Bay').split(',').map(c => c.trim());
      isMatchCity = rawCities.some(c => matchesPrefixSequence(c, q));
    } else {
      const rawCities = (npc.city || '').split(',').map(c => c.trim());
      isMatchCity = rawCities.some(c => matchesPrefixSequence(c, q));
    }

    if (isMatchName || isMatchCity) {
      let score = 10;
      if (npcName.toLowerCase() === q) score = 100;
      else if (npcName.toLowerCase().startsWith(q)) score = 50;
      else if (isMatchCity) score = 25;

      let avatarUrl = npc.imageUrl || '';
      if (avatarUrl && avatarUrl.includes('NPC_Bubble_')) avatarUrl = '';
      if (!avatarUrl && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
        avatarUrl = TibiaScraper.getFandomItemIconUrl(npcName);
      }

      let cityText = npc.city || 'Sin asignar';
      if (isRashid) {
        const rInfo = getRashidActiveSchedule();
        cityText = `${rInfo.schedule.city} (Hoy)`;
      } else if (isYasir) {
        cityText = npc.city || 'Carlin, Ankrahmun, Liberty Bay';
      }

      npcMatches.push({
        type: 'npc',
        id: npc.id,
        name: npcName,
        avatarUrl: avatarUrl,
        city: cityText,
        job: npc.job || 'Comerciante',
        buysCount: npc.itemsBuys?.length || 0,
        sellsCount: npc.itemsSells?.length || 0,
        score
      });
    }
  });

  // 2. Buscar Items coincidentes a través de todos los NPCs
  const itemMap = new Map();

  AppState.npcs.forEach(npc => {
    const isRashid = isRashidNpc(npc);
    const rashidTodayCity = isRashid ? getRashidActiveSchedule().schedule.city : '';
    const isYasir = isYasirNpc(npc);
    const effectiveCity = isRashid 
      ? rashidTodayCity 
      : (isYasir 
          ? (npc.city || 'Carlin, Ankrahmun, Liberty Bay') 
          : npc.city);

    if (mode === 'all' || mode === 'buys') {
      (npc.itemsBuys || []).forEach(item => {
        if (!item || !item.name) return;
        const itemName = item.name.trim();

        if (isItemMatch(item, q)) {
          const itemLower = itemName.toLowerCase();
          if (!itemMap.has(itemLower)) {
            let iconUrl = item.icon || '';
            if (!iconUrl || iconUrl.startsWith('data:image')) {
              if (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
                iconUrl = TibiaScraper.getFandomItemIconUrl(itemName);
              }
            }
            if (iconUrl && (iconUrl.includes('wikia.nocookie.net') || iconUrl.includes('fandom.com'))) {
              if (!iconUrl.includes('/revision/')) {
                const qIdx = iconUrl.indexOf('?');
                iconUrl = (qIdx !== -1 ? iconUrl.slice(0, qIdx) : iconUrl) + '/revision/latest?path-prefix=en';
              } else if (!iconUrl.includes('path-prefix=')) {
                iconUrl += (iconUrl.includes('?') ? '&' : '?') + 'path-prefix=en';
              }
            }

            let score = 10;
            if (itemLower === q) score = 100;
            else if (itemLower.startsWith(q)) score = 50;
            else if (matchesPrefixSequence(itemName, q)) score = 30;

            itemMap.set(itemLower, {
              type: 'item',
              name: itemName,
              iconUrl,
              buyers: [],
              sellers: [],
              maxBuyPrice: 0,
              minSellPrice: Infinity,
              score
            });
          }

          const entry = itemMap.get(itemLower);
          const price = item.price || 0;
          if (price > entry.maxBuyPrice) entry.maxBuyPrice = price;
          entry.buyers.push({ npcName: npc.name, price, city: effectiveCity });
        }
      });
    }

    if (mode === 'all' || mode === 'sells') {
      (npc.itemsSells || []).forEach(item => {
        if (!item || !item.name) return;
        const itemName = item.name.trim();

        if (isItemMatch(item, q)) {
          const itemLower = itemName.toLowerCase();
          if (!itemMap.has(itemLower)) {
            let iconUrl = item.icon || '';
            if (!iconUrl || iconUrl.startsWith('data:image')) {
              if (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
                iconUrl = TibiaScraper.getFandomItemIconUrl(itemName);
              }
            }
            if (iconUrl && (iconUrl.includes('wikia.nocookie.net') || iconUrl.includes('fandom.com'))) {
              if (!iconUrl.includes('/revision/')) {
                const qIdx = iconUrl.indexOf('?');
                iconUrl = (qIdx !== -1 ? iconUrl.slice(0, qIdx) : iconUrl) + '/revision/latest?path-prefix=en';
              } else if (!iconUrl.includes('path-prefix=')) {
                iconUrl += (iconUrl.includes('?') ? '&' : '?') + 'path-prefix=en';
              }
            }

            let score = 10;
            if (itemLower === q) score = 100;
            else if (itemLower.startsWith(q)) score = 50;
            else if (matchesPrefixSequence(itemName, q)) score = 30;

            itemMap.set(itemLower, {
              type: 'item',
              name: itemName,
              iconUrl,
              buyers: [],
              sellers: [],
              maxBuyPrice: 0,
              minSellPrice: Infinity,
              score
            });
          }

          const entry = itemMap.get(itemLower);
          const price = item.price || 0;
          if (price < entry.minSellPrice) entry.minSellPrice = price;
          entry.sellers.push({ npcName: npc.name, price, city: effectiveCity });
        }
      });
    }
  });

  // 3. Buscar Ciudades coincidentes por prefijo
  const cityMatches = [];
  const knownCities = typeof getAllCities === 'function' ? getAllCities() : [];
  knownCities.forEach(cityName => {
    if (matchesPrefixSequence(cityName, q)) {
      const cityLower = cityName.toLowerCase();
      let npcCount = 0;
      AppState.npcs.forEach(n => {
        if (isRashidNpc(n)) {
          const rCity = getRashidActiveSchedule().schedule.city.toLowerCase();
          if (rCity === cityLower) npcCount++;
        } else if (isYasirNpc(n)) {
          if ((n.city || 'Carlin, Ankrahmun, Liberty Bay').toLowerCase().includes(cityLower)) {
            npcCount++;
          }
        } else {
          const rawCities = (n.city || '').split(',').map(c => c.trim().toLowerCase());
          if (rawCities.includes(cityLower) || (n.city || '').toLowerCase().includes(cityLower)) {
            npcCount++;
          }
        }
      });

      let score = 25;
      if (cityLower === q) score = 120;
      else if (cityLower.startsWith(q)) score = 65;

      cityMatches.push({
        type: 'city',
        name: cityName,
        npcCount,
        score
      });
    }
  });

  const itemMatches = Array.from(itemMap.values());
  cityMatches.sort((a, b) => b.score - a.score || b.npcCount - a.npcCount || a.name.localeCompare(b.name));
  npcMatches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  itemMatches.sort((a, b) => b.score - a.score || b.buyers.length - a.buyers.length || a.name.localeCompare(b.name));

  return {
    cities: cityMatches.slice(0, 4),
    npcs: npcMatches.slice(0, 5),
    items: itemMatches.slice(0, 8)
  };
}

function renderSearchSuggestions(query) {
  const dropdown = document.getElementById('search-suggestions-dropdown');
  if (!dropdown) return;

  const data = getSearchSuggestionsData(query);
  const totalMatches = (data.cities?.length || 0) + data.items.length + data.npcs.length;

  if (totalMatches === 0) {
    dropdown.innerHTML = `
      <div class="suggestion-empty">
        No se encontraron ciudades, items o NPCs con "<strong>${escapeHtml(query)}</strong>"
      </div>
    `;
    dropdown.style.display = 'flex';
    currentSuggestionsList = [];
    currentSuggestionSelectionIndex = -1;
    return;
  }

  currentSuggestionsList = [];
  let html = '';

  // 1. Sección de Ciudades (Para filtrar de golpe todos los NPCs de la ciudad)
  if (data.cities && data.cities.length > 0) {
    html += `
      <div class="suggestion-section-title" style="border-bottom-color: rgba(168, 85, 247, 0.3);">
        <span style="color: #c084fc;">🏙️ Ciudades (${data.cities.length})</span>
      </div>
    `;

    data.cities.forEach(city => {
      const idx = currentSuggestionsList.length;
      currentSuggestionsList.push(city);

      html += `
        <div class="suggestion-item suggestion-item-city" data-index="${idx}">
          <div class="suggestion-icon-box suggestion-city-icon">
            🏙️
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name-row">
              <span class="suggestion-name" style="color: #f3e8ff;">${highlightMatch(city.name, query)}</span>
              <span class="suggestion-badge-type badge-type-city">Ciudad</span>
            </div>
            <div class="suggestion-details">
              <span>👥 <strong>${city.npcCount} ${city.npcCount === 1 ? 'NPC registrado' : 'NPCs registrados'}</strong></span>
            </div>
          </div>
        </div>
      `;
    });
  }

  // 2. Sección de NPCs
  if (data.npcs.length > 0) {
    html += `
      <div class="suggestion-section-title">
        <span>👤 NPCs Encontrados (${data.npcs.length})</span>
        <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-dim);">Haz clic para abrir ficha</span>
      </div>
    `;

    data.npcs.forEach(npc => {
      const idx = currentSuggestionsList.length;
      currentSuggestionsList.push(npc);

      const avatarHtml = npc.avatarUrl
        ? `<img src="${npc.avatarUrl}" data-src="${npc.avatarUrl}" alt="${npc.name}" referrerpolicy="no-referrer" loading="lazy" onerror="handleAvatarImageError(this)">`
        : DEFAULT_AVATAR_SVG;

      html += `
        <div class="suggestion-item" data-index="${idx}">
          <div class="suggestion-icon-box" style="border-radius: 50%;">
            ${avatarHtml}
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name-row">
              <span class="suggestion-name">${highlightMatch(npc.name, query)}</span>
              <span class="suggestion-badge-type badge-type-npc">NPC</span>
            </div>
            <div class="suggestion-details">
              <span>📍 ${npc.city}</span>
              <span>💼 ${npc.job}</span>
              <span style="color: var(--text-muted);">${npc.buysCount} compras / ${npc.sellsCount} ventas</span>
            </div>
          </div>
        </div>
      `;
    });
  }

  // 3. Sección de Items
  if (data.items.length > 0) {
    html += `
      <div class="suggestion-section-title">
        <span>📦 Items Encontrados (${data.items.length})</span>
        <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-dim);">Haz clic para filtrar</span>
      </div>
    `;

    data.items.forEach(item => {
      const idx = currentSuggestionsList.length;
      currentSuggestionsList.push(item);

      const iconHtml = item.iconUrl
        ? `<img src="${item.iconUrl}" data-src="${item.iconUrl}" alt="${item.name}" referrerpolicy="no-referrer" loading="lazy" onerror="handleItemImageError(this)">`
        : DEFAULT_ITEM_SVG;

      let tradeDetails = '';
      if (item.buyers.length > 0) {
        tradeDetails += `<span>💰 Compran: <strong>${item.buyers.length} ${item.buyers.length === 1 ? 'NPC' : 'NPCs'}</strong> (Hasta <strong class="suggestion-price">${formatNumber(item.maxBuyPrice)} gp</strong>)</span>`;
      }
      if (item.sellers.length > 0) {
        tradeDetails += `<span>🏷️ Venden: <strong>${item.sellers.length} ${item.sellers.length === 1 ? 'NPC' : 'NPCs'}</strong> (Desde <strong class="suggestion-price">${formatNumber(item.minSellPrice)} gp</strong>)</span>`;
      }

      html += `
        <div class="suggestion-item" data-index="${idx}">
          <div class="suggestion-icon-box">
            ${iconHtml}
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name-row">
              <span class="suggestion-name">${highlightMatch(item.name, query)}</span>
              <span class="suggestion-badge-type badge-type-item">Item</span>
            </div>
            <div class="suggestion-details">
              ${tradeDetails}
            </div>
          </div>
        </div>
      `;
    });
  }

  dropdown.innerHTML = html;
  dropdown.style.display = 'flex';
  currentSuggestionSelectionIndex = -1;

  // Clicks en sugerencias
  dropdown.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (currentSuggestionsList[idx]) {
        selectSearchSuggestion(currentSuggestionsList[idx]);
      }
    });
  });
}

function selectSearchSuggestion(item) {
  const searchInput = document.getElementById('search-input');
  if (!searchInput) return;

  hideSearchSuggestions();

  if (item.type === 'city') {
    searchInput.value = item.name;
    AppState.searchQuery = item.name.toLowerCase().trim();
    AppState.cityFilter = '';

    const btnClearSearch = document.getElementById('btn-clear-search');
    if (btnClearSearch) {
      btnClearSearch.style.display = 'flex';
    }

    renderApp();
    return;
  }

  if (item.type === 'item') {
    searchInput.value = item.name;
    AppState.searchQuery = item.name.toLowerCase().trim();
    const btnClear = document.getElementById('btn-clear-search');
    if (btnClear) btnClear.style.display = 'flex';
    renderApp();
  } else if (item.type === 'npc') {
    searchInput.value = item.name;
    AppState.selectedNpcId = item.id;
    AppState.searchQuery = item.name.toLowerCase().trim();
    const btnClear = document.getElementById('btn-clear-search');
    if (btnClear) btnClear.style.display = 'flex';
    renderApp();
    setTimeout(() => {
      const card = document.querySelector(`.npc-card[data-id="${item.id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }
}

// ==========================================
// RENDERIZADO PRINCIPAL
// ==========================================
function renderApp() {
  const filtered = getFilteredNpcs();
  if (filtered.length > 0 && !filtered.some(n => n.id === AppState.selectedNpcId)) {
    AppState.selectedNpcId = filtered[0].id;
  }

  // Si el usuario busca un item (especialmente en modo 'buys' o si el NPC compra el item buscado),
  // auto-activar la pestaña correspondiente
  const selectedNpc = AppState.npcs.find(n => n.id === AppState.selectedNpcId);
  if (AppState.searchMode === 'buys') {
    AppState.activeItemTab = 'buys';
  } else if (AppState.searchMode === 'sells') {
    AppState.activeItemTab = 'sells';
  } else if (selectedNpc && AppState.searchQuery) {
    const q = AppState.searchQuery.trim().toLowerCase();
    const buysThisItem = selectedNpc.itemsBuys && selectedNpc.itemsBuys.some(i => isItemMatch(i, q));
    const sellsThisItem = selectedNpc.itemsSells && selectedNpc.itemsSells.some(i => isItemMatch(i, q));

    if (buysThisItem && !sellsThisItem) {
      AppState.activeItemTab = 'buys';
    } else if (sellsThisItem && !buysThisItem) {
      AppState.activeItemTab = 'sells';
    } else if (buysThisItem && sellsThisItem) {
      if (AppState.activeItemTab !== 'buys' && AppState.activeItemTab !== 'sells') {
        AppState.activeItemTab = 'buys';
      }
    }
  }

  renderNpcList();
  renderDetailPanel();
  updateStatsBadge();
}

// Actualizar contador
function updateStatsBadge() {
  const total = AppState.npcs.length;
  const statsBadge = document.getElementById('stats-badge');
  if (statsBadge) {
    statsBadge.textContent = `${total} ${total === 1 ? 'NPC registrado' : 'NPCs registrados'}`;
  }

  const backupTotalEl = document.getElementById('backup-total-npcs-count');
  if (backupTotalEl) {
    backupTotalEl.textContent = total;
  }

  const backupBtnEl = document.getElementById('backup-btn-npcs-count');
  if (backupBtnEl) {
    backupBtnEl.textContent = total;
  }

  const allNpcsModalCount = document.getElementById('all-npcs-modal-count');
  if (allNpcsModalCount) {
    allNpcsModalCount.textContent = total;
  }
}

// Filtrar lista de NPCs
function getFilteredNpcs() {
  const mode = AppState.searchMode || 'all';
  const q = (AppState.searchQuery || '').trim().toLowerCase();
  const normalizedQ = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Ciudades registradas para distinguir búsquedas de ciudad vs items
  const knownCities = typeof getAllCities === 'function' ? getAllCities().map(c => c.toLowerCase()) : [];
  const isExactCityQuery = knownCities.includes(q);

  return AppState.npcs.filter(npc => {
    // Para Rashid: su ciudad y ubicación efectivas para búsqueda y filtros son ESTRICTAMENTE las de HOY
    const isRashid = isRashidNpc(npc);
    const rashidToday = isRashid ? getRashidActiveSchedule().schedule : null;

    // Para Yasir: si está activo en el servidor objetivo (Solidera), toma su puerto actual; si está inactivo, no tiene ciudad hoy
    const isYasir = isYasirNpc(npc);
    const yasirInfo = isYasir ? getCachedYasirInfo() : null;

    let effectiveCity = (npc.city || '').toLowerCase();
    let effectiveLoc = (npc.location || '').toLowerCase();

    if (isRashid) {
      effectiveCity = rashidToday.city.toLowerCase();
      effectiveLoc = rashidToday.location.toLowerCase();
    } else if (isYasir) {
      const baseCities = npc.city ? npc.city.toLowerCase() : 'carlin, ankrahmun, liberty bay';
      let combined = baseCities;
      if (!combined.includes('carlin')) combined += ', carlin';
      if (!combined.includes('ankrahmun')) combined += ', ankrahmun';
      if (!combined.includes('liberty bay')) combined += ', liberty bay';
      effectiveCity = combined;
      effectiveLoc = (npc.location || combined).toLowerCase();
    }

    // 1. Filtro desplegable por Ciudad (admite múltiples ciudades por NPC)
    if (AppState.cityFilter) {
      const filter = AppState.cityFilter.toLowerCase();
      if (!effectiveCity.includes(filter) && !effectiveLoc.includes(filter)) {
        return false;
      }
    }

    // 2. Filtro desplegable por Comercio
    const effectiveTrade = AppState.tradeFilter || (mode === 'buys' ? 'buys' : mode === 'sells' ? 'sells' : '');
    if (effectiveTrade === 'sells') {
      if (!npc.itemsSells || npc.itemsSells.length === 0) return false;
    } else if (effectiveTrade === 'buys') {
      if (!npc.itemsBuys || npc.itemsBuys.length === 0) return false;
    }

    // 3. Filtro por campo de búsqueda de texto y modo de búsqueda
    if (q) {
      const matchItemName = (item) => {
        if (!item || !item.name) return false;
        return isItemMatch(item, q);
      };

      // Modo específico: "¿Quién lo Compra?" -> Solo NPCs que compren este item
      if (mode === 'buys') {
        const matchesBuy = npc.itemsBuys?.some(matchItemName);
        return !!matchesBuy;
      }

      // Modo específico: "¿Quién lo Vende?" -> Solo NPCs que vendan este item
      if (mode === 'sells') {
        const matchesSell = npc.itemsSells?.some(matchItemName);
        return !!matchesSell;
      }

      // Modo General ('all'):
      const npcName = (npc.name || '').trim();
      const npcJob = (npc.job || '').trim();

      const matchName = matchesPrefixSequence(npcName, q);

      const cityList = effectiveCity.split(',').map(c => c.trim());
      const matchCity = cityList.some(c => matchesPrefixSequence(c, q));
      const matchLoc = matchesPrefixSequence(effectiveLoc, q);
      const matchJob = matchesPrefixSequence(npcJob, q);

      // Si el término escrito es exactamente el nombre de una ciudad (ej: 'carlin', 'darashia', 'ankrahmun'),
      // el usuario está buscando la CIUDAD, NO items que contengan el nombre (ej: 'Carlin Sword')
      if (isExactCityQuery) {
        return matchCity || matchLoc;
      }

      const matchBuyItem = npc.itemsBuys?.some(matchItemName);
      const matchSellItem = npc.itemsSells?.some(matchItemName);

      if (!matchBuyItem && !matchSellItem && !matchName && !matchCity && !matchLoc && !matchJob) {
        return false;
      }
    }

    return true;
  });
}

// Renderizar columna izquierda: Lista de NPCs
function renderNpcList() {
  const container = document.getElementById('npc-cards-list');
  const filtered = getFilteredNpcs();

  if (filtered.length === 0) {
    if (AppState.npcs.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
          No hay NPCs guardados todavía.<br>Agrega uno con los botones superiores.
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">
          No se encontraron NPCs que coincidan con la búsqueda.
        </div>
      `;
    }
    return;
  }

  let html = '';
  filtered.forEach(npc => {
    const isActive = npc.id === AppState.selectedNpcId;
    const sellsCount = npc.itemsSells ? npc.itemsSells.length : 0;
    const buysCount = npc.itemsBuys ? npc.itemsBuys.length : 0;

    let avatarUrl = npc.imageUrl;
    if (avatarUrl && avatarUrl.includes('NPC_Bubble_')) {
      avatarUrl = '';
    }
    if (!avatarUrl && npc.name && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
      avatarUrl = TibiaScraper.getFandomItemIconUrl(npc.name);
    }

    const avatarHtml = avatarUrl 
      ? `<img src="${avatarUrl}" data-src="${avatarUrl}" alt="${npc.name}" referrerpolicy="no-referrer" onerror="handleAvatarImageError(this)">`
      : DEFAULT_AVATAR_SVG;

    // Distintivo destacado del item si hay búsqueda activa de texto (solo si no es búsqueda estricta de ciudad)
    let itemMatchBadge = '';
    const knownCitiesList = typeof getAllCities === 'function' ? getAllCities().map(c => c.toLowerCase()) : [];
    const isCitySearch = AppState.searchMode === 'all' && knownCitiesList.includes((AppState.searchQuery || '').trim().toLowerCase());

    if (AppState.searchQuery && !isCitySearch) {
      const q = AppState.searchQuery.trim().toLowerCase();
      const matchingBuyItems = (npc.itemsBuys || []).filter(item => isItemMatch(item, q));
      if (matchingBuyItems.length > 0 && (AppState.searchMode === 'all' || AppState.searchMode === 'buys')) {
        const first = matchingBuyItems[0];
        const extra = matchingBuyItems.length > 1 ? ` (+${matchingBuyItems.length - 1} más)` : '';
        itemMatchBadge = `
          <div class="badge-item-match" title="Compra: ${matchingBuyItems.map(i => `${i.name} (${formatNumber(i.price)} gp)`).join(', ')}">
            <span>💰 Compra: <strong>${first.name}</strong> a ${formatNumber(first.price)} gp${extra}</span>
          </div>
        `;
      } else if (AppState.searchMode === 'all' || AppState.searchMode === 'sells') {
        const matchingSellItems = (npc.itemsSells || []).filter(item => isItemMatch(item, q));
        if (matchingSellItems.length > 0) {
          const first = matchingSellItems[0];
          const extra = matchingSellItems.length > 1 ? ` (+${matchingSellItems.length - 1} más)` : '';
          itemMatchBadge = `
            <div class="badge-item-match" style="border-color: #38bdf8; background: rgba(56, 189, 248, 0.15); color: #7dd3fc;" title="Vende: ${matchingSellItems.map(i => `${i.name} (${formatNumber(i.price)} gp)`).join(', ')}">
              <span>🏷️ Vende: <strong>${first.name}</strong> a ${formatNumber(first.price)} gp${extra}</span>
            </div>
          `;
        }
      }
    }

    let locationHtml = `<span>📍</span> ${npc.city || 'Sin ciudad'}`;
    let itinerantBadge = '';

    if (isRashidNpc(npc)) {
      const rInfo = getRashidActiveSchedule();
      locationHtml = `<span style="color: var(--gold-light);">🐪 Hoy:</span> <strong>${rInfo.schedule.city}</strong> <span style="font-size: 0.72rem; color: #34d399; font-weight: 600;">(${rInfo.schedule.dayShort})</span>`;
      itinerantBadge = `<span class="badge-micro badge-rashid-live">Viajero 🧭</span>`;
    } else if (isYasirNpc(npc)) {
      const cityList = npc.city || 'Carlin, Ankrahmun, Liberty Bay';
      locationHtml = `<span style="color: var(--gold-light);">🚢 Puertos:</span> <strong style="color: #38bdf8;">${cityList}</strong>`;
      itinerantBadge = `<span class="badge-micro badge-rashid-live">Viajero 🧭</span>`;
    }

    html += `
      <div class="npc-card ${isActive ? 'active' : ''}" data-id="${npc.id}">
        <div class="npc-avatar-box">
          ${avatarHtml}
        </div>
        <div class="npc-card-info">
          <div class="npc-card-name" title="${npc.name}">${npc.name}</div>
          <div class="npc-card-location" title="${npc.city || 'Ubicación'}">
            ${locationHtml}
          </div>
          <div class="npc-card-badges">
            <span class="badge-micro badge-sell">Vende: ${sellsCount}</span>
            <span class="badge-micro badge-buy">Compra: ${buysCount}</span>
            ${itinerantBadge}
          </div>
          ${itemMatchBadge}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Event clicks en tarjetas
  container.querySelectorAll('.npc-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      AppState.selectedNpcId = id;
      renderApp();
    });
  });
}

// Renderizar columna derecha: Detalle del NPC o Estado Vacío
function renderDetailPanel() {
  const panel = document.getElementById('npc-detail-panel');
  const selectedNpc = AppState.npcs.find(n => n.id === AppState.selectedNpcId);

  // Si no hay NPCs en la base de datos o no hay seleccionado
  if (!selectedNpc) {
    if (AppState.npcs.length === 0) {
      panel.innerHTML = `
        <div class="empty-state-view">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h2>La Lista de NPCs está Vacía</h2>
          <p>
            Tu sistema rastreador está listo para comenzar a ser poblado. Puedes ingresar los datos manualmente o extraer automáticamente toda la información de un NPC (nombre, ciudad, coordenadas e items de compra/venta) usando un enlace de Tibia Wiki.
          </p>
          <div class="empty-actions">
            <button class="btn btn-scraper" onclick="openModal('modal-scraper')">
              🕷️ Raspar NPC desde Link / Wiki
            </button>
            <button class="btn btn-primary" onclick="openNpcFormModal(null)">
              ➕ Registrar NPC Manualmente
            </button>
            <button class="btn btn-secondary" onclick="openModal('modal-backup')">
              💾 Cargar Copia o Demo
            </button>
          </div>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div class="empty-state-view">
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h2>Selecciona un NPC de la lista</h2>
          <p>Selecciona un NPC del panel lateral izquierdo para ver su ubicación en el mapa, sus items a la venta y los items que compra.</p>
        </div>
      `;
    }
    return;
  }

  // Si hay un NPC seleccionado, renderizar ficha completa
  let avatarUrl = selectedNpc.imageUrl;
  if (avatarUrl && avatarUrl.includes('NPC_Bubble_')) {
    avatarUrl = '';
  }
  if (!avatarUrl && selectedNpc.name && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
    avatarUrl = TibiaScraper.getFandomItemIconUrl(selectedNpc.name);
  }

  const avatarHtml = avatarUrl 
    ? `<img src="${avatarUrl}" data-src="${avatarUrl}" alt="${selectedNpc.name}" referrerpolicy="no-referrer" onerror="handleAvatarImageError(this)">`
    : DEFAULT_AVATAR_SVG;

  const isRashid = isRashidNpc(selectedNpc);
  const isYasir = isYasirNpc(selectedNpc);
  const currentTibiaDay = getTibiaServerSaveDayIndex();
  const selectedDayIndex = isRashid 
    ? (AppState.rashidSelectedDay !== null ? AppState.rashidSelectedDay : currentTibiaDay)
    : null;
  const rashidDaySchedule = isRashid ? RASHID_SCHEDULE[selectedDayIndex] : null;
  const yasirInfo = isYasir ? getCachedYasirInfo() : null;

  const hasCoords = isRashid 
    ? true 
    : (isYasir ? true : (selectedNpc.coordinates && (selectedNpc.coordinates.x || selectedNpc.coordinates.y)));

  let coordX = selectedNpc.coordinates?.x || 'N/A';
  let coordY = selectedNpc.coordinates?.y || 'N/A';
  let coordZ = selectedNpc.coordinates?.z || '7';

  if (isRashid) {
    coordX = rashidDaySchedule.coords.x;
    coordY = rashidDaySchedule.coords.y;
    coordZ = rashidDaySchedule.coords.z;
  } else if (isYasir) {
    if (selectedNpc.coordinates && (selectedNpc.coordinates.x || selectedNpc.coordinates.y)) {
      coordX = selectedNpc.coordinates.x;
      coordY = selectedNpc.coordinates.y;
      coordZ = selectedNpc.coordinates.z || '7';
    } else {
      coordX = yasirInfo.port.coordinates.x;
      coordY = yasirInfo.port.coordinates.y;
      coordZ = yasirInfo.port.coordinates.z;
    }
  }

  let displayCity = selectedNpc.city || 'Desconocida';
  let displayLocation = selectedNpc.location;

  if (isRashid) {
    displayCity = `${rashidDaySchedule.city} (${rashidDaySchedule.dayName})`;
    displayLocation = rashidDaySchedule.location;
  } else if (isYasir) {
    displayCity = selectedNpc.city || 'Carlin, Ankrahmun, Liberty Bay';
    displayLocation = selectedNpc.location || 'Muelles al sur de Carlin / Muelle este de Ankrahmun / Muelles de Liberty Bay';
  }

  const totalSellsCount = selectedNpc.itemsSells ? selectedNpc.itemsSells.length : 0;
  const totalBuysCount = selectedNpc.itemsBuys ? selectedNpc.itemsBuys.length : 0;

  const qTop = (AppState.searchQuery || '').trim().toLowerCase();
  const knownCities = typeof getAllCities === 'function' ? getAllCities().map(c => c.toLowerCase()) : [];
  const isCitySearch = AppState.searchMode === 'all' && knownCities.includes(qTop);
  const isNpcSearch = AppState.searchMode === 'all' && matchesPrefixSequence(selectedNpc.name, qTop);

  const isFilteringByItem = Boolean(
    qTop && 
    !isCitySearch && 
    !isNpcSearch && 
    (AppState.searchMode !== 'all' || 
     AppState.npcs.some(n => (n.itemsBuys || []).some(i => isItemMatch(i, qTop)) || (n.itemsSells || []).some(i => isItemMatch(i, qTop))))
  );

  let sellsCount = totalSellsCount;
  let buysCount = totalBuysCount;

  if (isFilteringByItem) {
    sellsCount = (selectedNpc.itemsSells || []).filter(i => isItemMatch(i, qTop)).length;
    buysCount = (selectedNpc.itemsBuys || []).filter(i => isItemMatch(i, qTop)).length;
  }

  const wikiUrl = (selectedNpc.sourceUrl && selectedNpc.sourceUrl.trim()) 
    ? selectedNpc.sourceUrl.trim() 
    : `https://tibia.fandom.com/wiki/${encodeURIComponent(selectedNpc.name.trim().replace(/\s+/g, '_'))}`;

  // Bloque de Itinerario interactivo exclusivo de Rashid
  let rashidItineraryHtml = '';
  if (isRashid) {
    const daysOrder = [1, 2, 3, 4, 5, 6, 0];
    const daysButtonsHtml = daysOrder.map(dIdx => {
      const dayData = RASHID_SCHEDULE[dIdx];
      const isSelected = dIdx === selectedDayIndex;
      const isToday = dIdx === currentTibiaDay;
      return `
        <button type="button" class="rashid-day-btn ${isSelected ? 'active' : ''} ${isToday ? 'is-today' : ''}" data-day="${dIdx}" title="${dayData.dayName}: ${dayData.city}">
          ${isToday ? '<span class="rashid-badge-today">HOY</span>' : ''}
          <span class="rashid-day-name">${dayData.dayShort}</span>
          <span class="rashid-day-city">${dayData.city}</span>
        </button>
      `;
    }).join('');

    rashidItineraryHtml = `
      <div class="rashid-itinerary-card">
        <div class="rashid-itinerary-header">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span style="font-size: 1.35rem;">🐪</span>
            <div>
              <h4 style="color: var(--gold-light); font-size: 0.95rem; margin: 0; font-family: var(--font-fantasy); letter-spacing: 0.5px;">Itinerario Semanal de Rashid</h4>
            </div>
          </div>
          <div class="rashid-today-indicator">
            <span>⏰ Hoy en Tibia: <strong>${RASHID_SCHEDULE[currentTibiaDay].dayName} (${RASHID_SCHEDULE[currentTibiaDay].city})</strong></span>
          </div>
        </div>

        <div class="rashid-days-grid">
          ${daysButtonsHtml}
        </div>
      </div>
    `;
  }

  panel.innerHTML = `
    <!-- Header del NPC -->
    <div class="detail-header">
      <div class="detail-profile">
        <div class="detail-avatar">
          ${avatarHtml}
        </div>
        <div class="detail-title">
          <h2>${selectedNpc.name}</h2>
          <div class="detail-meta-tags">
            <span class="meta-tag tag-city">
              📍 ${displayCity} ${isRashid ? '🐪' : isYasir ? '🚢' : ''}
            </span>
            <span class="meta-tag tag-job">💼 ${selectedNpc.job || (isRashid ? 'Comerciante Viajero' : isYasir ? 'Comerciante Oriental' : 'Comerciante')}</span>
            ${!isRashid && displayLocation && displayLocation !== selectedNpc.city ? `<span class="meta-tag">🗺️ ${displayLocation}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="detail-header-actions">
        <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Abrir página oficial de ${selectedNpc.name} en Tibia Wiki">
          🌐 Ver Wiki ↗
        </a>
        ${(!isRashid) ? `
          <button id="btn-edit-location" class="btn btn-secondary btn-sm" title="Editar ciudades y ubicación de ${selectedNpc.name}">
            📍 Editar Ubicación
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Itinerario de Rashid si aplica -->
    ${rashidItineraryHtml}

    <!-- Sección de Mapa -->
    ${isYasir ? `
      <div class="map-preview-card yasir-map-preview-compact">
        <div class="yasir-compact-header">
          <span class="yasir-map-icon">🗺️</span>
          <span class="yasir-compact-title">Puertos:</span>
        </div>

        <div class="yasir-compact-ports-row">
          ${Object.keys(YASIR_PORTS).map(portKey => {
            const p = YASIR_PORTS[portKey];
            return `
              <div class="yasir-compact-port-chip" title="${p.name} (${p.desc}): ${p.location}">
                <span class="yasir-chip-name">🏙️ ${p.name}</span>
                <div class="yasir-chip-actions">
                  <button type="button" class="btn btn-primary btn-xs btn-open-yasir-port-map" data-port="${portKey}" title="Ver ${p.name} en Mapa Interactivo">📍 Mapa</button>
                  <a href="${p.mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs yasir-tibiamaps-btn" title="Abrir ${p.name} en TibiaMaps.io">TibiaMaps.io ↗</a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : `
      <div class="map-preview-card">
        <div style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">
          <span style="font-size: 1.15rem;">🗺️</span>
          <span style="color: var(--text-main); font-weight: 600;">
            ${isRashid ? `Ubicación de ${rashidDaySchedule.dayName} en ${rashidDaySchedule.city}` : 'Ubicación en el Mapa'}
          </span>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
          ${hasCoords ? `
            <button id="btn-open-interactive-map" class="btn btn-primary btn-sm">
              📍 Ver en Mapa Interactivo
            </button>
            <a href="https://tibiamaps.io/map#${coordX},${coordY},${coordZ}:2" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
              TibiaMaps.io ↗
            </a>
          ` : `
            <span style="font-size: 0.85rem; color: var(--text-dim);">Sin mapa disponible para este NPC</span>
          `}
        </div>
      </div>
    `}

    <!-- Sección de Items (Compra y Venta) -->
    <div class="items-section">
      <div class="tabs-nav">
        <button id="tab-items-sells" class="tab-btn ${AppState.activeItemTab === 'sells' ? 'active' : ''}">
          📦 Lo que Vende <span class="tab-badge">${sellsCount}</span>
        </button>
        <button id="tab-items-buys" class="tab-btn ${AppState.activeItemTab === 'buys' ? 'active' : ''}">
          💰 Lo que Compra <span class="tab-badge">${buysCount}</span>
        </button>
      </div>

      <!-- Barra de Filtro y Ordenamiento de Items -->
      <div class="items-filter-bar">
        <div class="item-search-wrapper">
          <input 
            type="text" 
            id="item-search-filter" 
            class="item-search-input" 
            placeholder="Filtrar items en la tabla..." 
            value="${AppState.itemSearchQuery || ''}"
          >
          <button type="button" id="btn-clear-item-filter" class="input-clear-btn item-clear-btn" title="Borrar filtro de items" aria-label="Borrar filtro de items" style="${AppState.itemSearchQuery ? 'display: flex;' : 'display: none;'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="items-sort-buttons">
          <button id="btn-sort-name" class="btn btn-secondary btn-sm ${AppState.itemSortField === 'name' ? 'active' : ''}" title="Ordenar alfabéticamente por nombre">
            🔤 Nombre ${AppState.itemSortField === 'name' ? (AppState.itemSortOrder === 'asc' ? 'A-Z ↑' : 'Z-A ↓') : '↕'}
          </button>
          <button id="btn-sort-price" class="btn btn-secondary btn-sm ${AppState.itemSortField === 'price' ? 'active' : ''}" title="Ordenar por precio">
            💰 Precio ${AppState.itemSortField === 'price' ? (AppState.itemSortOrder === 'desc' ? 'Mayor ↓' : 'Menor ↑') : '↕'}
          </button>
        </div>
      </div>

      <!-- Tabla de Items -->
      <div class="table-wrapper">
        <table class="items-table">
          <thead>
            <tr>
              <th id="th-sort-name" class="sortable-th" style="width: 50%;" title="Clic para ordenar alfabéticamente por nombre">
                Item <span class="sort-icon">${AppState.itemSortField === 'name' ? (AppState.itemSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
              </th>
              <th id="th-sort-price" class="sortable-th" style="width: 25%;" title="Clic para ordenar por precio">
                Precio <span class="sort-icon">${AppState.itemSortField === 'price' ? (AppState.itemSortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
              </th>
              <th style="width: 25%;">Notas / Moneda</th>
            </tr>
          </thead>
          <tbody id="items-table-body">
            <!-- Filas inyectadas por renderItemsTable -->
          </tbody>
        </table>
      </div>
    </div>

    <!-- Acciones al pie del panel: Botón de eliminar hasta abajo a la derecha -->
    <div class="detail-footer-actions">
      <button id="btn-delete-current-npc" class="btn btn-danger btn-sm" title="Eliminar este NPC">
        🗑️ Eliminar NPC
      </button>
    </div>
  `;

  // Enganchar listeners de la vista de detalle
  // Manejadores interactivos para días del itinerario de Rashid
  if (isRashid) {
    panel.querySelectorAll('.rashid-day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.getAttribute('data-day'), 10);
        AppState.rashidSelectedDay = day;
        renderDetailPanel();
      });
    });

    const btnResetRashidToday = document.getElementById('btn-rashid-reset-today');
    if (btnResetRashidToday) {
      btnResetRashidToday.addEventListener('click', () => {
        AppState.rashidSelectedDay = null;
        renderDetailPanel();
      });
    }
  }



  const btnEditLoc = document.getElementById('btn-edit-location');
  if (btnEditLoc) {
    btnEditLoc.addEventListener('click', () => {
      openEditLocationModal(selectedNpc);
    });
  }

  const btnDeleteCurrent = document.getElementById('btn-delete-current-npc');
  if (btnDeleteCurrent) {
    btnDeleteCurrent.addEventListener('click', () => {
      confirmDeleteNpc(selectedNpc.id);
    });
  }

  const btnMap = document.getElementById('btn-open-interactive-map');
  if (btnMap) {
    btnMap.addEventListener('click', () => {
      openMapModal(selectedNpc);
    });
  }

  // Manejadores para abrir mapas específicos de los 3 puertos de Yasir
  panel.querySelectorAll('.btn-open-yasir-port-map').forEach(btn => {
    btn.addEventListener('click', () => {
      const portKey = btn.getAttribute('data-port');
      const portData = YASIR_PORTS[portKey];
      if (portData) {
        openMapModal(selectedNpc, portData.coordinates, portData.name);
      }
    });
  });

  // Pestañas de Items
  const tabSells = document.getElementById('tab-items-sells');
  const tabBuys = document.getElementById('tab-items-buys');

  tabSells.addEventListener('click', () => {
    AppState.activeItemTab = 'sells';
    tabSells.classList.add('active');
    tabBuys.classList.remove('active');
    renderItemsTable(selectedNpc);
  });

  tabBuys.addEventListener('click', () => {
    AppState.activeItemTab = 'buys';
    tabBuys.classList.add('active');
    tabSells.classList.remove('active');
    renderItemsTable(selectedNpc);
  });

  // Filtro de items en tiempo real
  const itemSearch = document.getElementById('item-search-filter');
  const btnClearItemFilter = document.getElementById('btn-clear-item-filter');

  function updateClearItemFilterVisibility() {
    if (btnClearItemFilter && itemSearch) {
      btnClearItemFilter.style.display = itemSearch.value.trim().length > 0 ? 'flex' : 'none';
    }
  }

  if (itemSearch) {
    itemSearch.addEventListener('input', (e) => {
      AppState.itemSearchQuery = e.target.value.toLowerCase().trim();
      updateClearItemFilterVisibility();
      renderItemsTable(selectedNpc);
    });

    itemSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        AppState.itemSearchQuery = e.target.value.toLowerCase().trim();
        updateClearItemFilterVisibility();
        renderItemsTable(selectedNpc);
      }
    });
  }

  if (btnClearItemFilter) {
    btnClearItemFilter.addEventListener('click', (e) => {
      e.stopPropagation();
      if (itemSearch) {
        itemSearch.value = '';
        AppState.itemSearchQuery = '';
        updateClearItemFilterVisibility();
        itemSearch.focus();
        renderItemsTable(selectedNpc);
      }
    });
  }

  // Ordenamiento por nombre y precio
  function updateItemSortIndicators() {
    const btnName = document.getElementById('btn-sort-name');
    const btnPrice = document.getElementById('btn-sort-price');
    const thName = document.getElementById('th-sort-name');
    const thPrice = document.getElementById('th-sort-price');

    if (btnName) {
      btnName.classList.toggle('active', AppState.itemSortField === 'name');
      btnName.innerHTML = `🔤 Nombre ${AppState.itemSortField === 'name' ? (AppState.itemSortOrder === 'asc' ? 'A-Z ↑' : 'Z-A ↓') : '↕'}`;
    }
    if (btnPrice) {
      btnPrice.classList.toggle('active', AppState.itemSortField === 'price');
      btnPrice.innerHTML = `💰 Precio ${AppState.itemSortField === 'price' ? (AppState.itemSortOrder === 'desc' ? 'Mayor ↓' : 'Menor ↑') : '↕'}`;
    }
    if (thName) {
      const icon = thName.querySelector('.sort-icon');
      if (icon) icon.textContent = AppState.itemSortField === 'name' ? (AppState.itemSortOrder === 'asc' ? '▲' : '▼') : '↕';
    }
    if (thPrice) {
      const icon = thPrice.querySelector('.sort-icon');
      if (icon) icon.textContent = AppState.itemSortField === 'price' ? (AppState.itemSortOrder === 'asc' ? '▲' : '▼') : '↕';
    }
  }

  const handleItemSortToggle = (field) => {
    if (AppState.itemSortField === field) {
      AppState.itemSortOrder = AppState.itemSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      AppState.itemSortField = field;
      // Por defecto: 'asc' para nombre (A-Z), 'desc' para precio (del más caro al más barato)
      AppState.itemSortOrder = field === 'price' ? 'desc' : 'asc';
    }
    updateItemSortIndicators();
    renderItemsTable(selectedNpc);
  };

  const btnSortName = document.getElementById('btn-sort-name');
  if (btnSortName) btnSortName.addEventListener('click', () => handleItemSortToggle('name'));

  const thSortName = document.getElementById('th-sort-name');
  if (thSortName) thSortName.addEventListener('click', () => handleItemSortToggle('name'));

  const btnSortPrice = document.getElementById('btn-sort-price');
  if (btnSortPrice) btnSortPrice.addEventListener('click', () => handleItemSortToggle('price'));

  const thSortPrice = document.getElementById('th-sort-price');
  if (thSortPrice) thSortPrice.addEventListener('click', () => handleItemSortToggle('price'));

  // Renderizar la tabla de items inicial
  renderItemsTable(selectedNpc);
}

// Renderizar tabla de items según pestaña y filtro
function renderItemsTable(npc) {
  const tbody = document.getElementById('items-table-body');
  if (!tbody) return;

  const rawItems = AppState.activeItemTab === 'sells' ? (npc.itemsSells || []) : (npc.itemsBuys || []);
  
  let filtered = [...rawItems];
  const qItem = (AppState.itemSearchQuery || '').trim().toLowerCase();
  const qTop = (AppState.searchQuery || '').trim().toLowerCase();

  const knownCities = typeof getAllCities === 'function' ? getAllCities().map(c => c.toLowerCase()) : [];
  const isCitySearch = AppState.searchMode === 'all' && knownCities.includes(qTop);
  const isNpcSearch = AppState.searchMode === 'all' && matchesPrefixSequence(npc.name, qTop);

  const isFilteringByItem = Boolean(
    qTop && 
    !isCitySearch && 
    !isNpcSearch && 
    (AppState.searchMode !== 'all' || 
     AppState.npcs.some(n => (n.itemsBuys || []).some(i => isItemMatch(i, qTop)) || (n.itemsSells || []).some(i => isItemMatch(i, qTop))))
  );

  if (qItem) {
    filtered = filtered.filter(item => 
      isItemMatch(item, qItem) ||
      matchesPrefixSequence(item.notes, qItem)
    );
  } else if (isFilteringByItem) {
    // Si hay búsqueda activa de item desde la barra superior,
    // filtrar de forma estricta la tabla tanto para lo que vende como para lo que compra
    filtered = rawItems.filter(item => isItemMatch(item, qTop));
  }

  // Ordenamiento por nombre (A-Z / Z-A) o precio (mayor a menor / menor a mayor)
  if (AppState.itemSortField === 'name') {
    filtered.sort((a, b) => {
      const cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      return AppState.itemSortOrder === 'asc' ? cmp : -cmp;
    });
  } else if (AppState.itemSortField === 'price') {
    filtered.sort((a, b) => {
      const pA = Number(a.price) || 0;
      const pB = Number(b.price) || 0;
      return AppState.itemSortOrder === 'asc' ? pA - pB : pB - pA;
    });
  }

  if (filtered.length === 0) {
    let emptyMessage = 'No hay items que coincidan con la búsqueda.';
    if (rawItems.length === 0) {
      emptyMessage = 'Este NPC no tiene items registrados en esta lista.';
    } else if (isFilteringByItem && qTop) {
      emptyMessage = AppState.activeItemTab === 'buys'
        ? `Este NPC no compra ningún item que coincida con "<strong>${escapeHtml(qTop)}</strong>".`
        : `Este NPC no vende ningún item que coincida con "<strong>${escapeHtml(qTop)}</strong>".`;
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-dim);">
          ${emptyMessage}
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  filtered.forEach(item => {
    let iconUrl = item.icon || '';
    if (!iconUrl || iconUrl.startsWith('data:image')) {
      if (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
        iconUrl = TibiaScraper.getFandomItemIconUrl(item.name);
      }
    }
    if (iconUrl && (iconUrl.includes('wikia.nocookie.net') || iconUrl.includes('fandom.com'))) {
      if (!iconUrl.includes('/revision/')) {
        const qIdx = iconUrl.indexOf('?');
        iconUrl = (qIdx !== -1 ? iconUrl.slice(0, qIdx) : iconUrl) + '/revision/latest?path-prefix=en';
      } else if (!iconUrl.includes('path-prefix=')) {
        iconUrl += (iconUrl.includes('?') ? '&' : '?') + 'path-prefix=en';
      }
    }

    const itemThumbHtml = iconUrl 
      ? `<img src="${iconUrl}" data-src="${iconUrl}" alt="${item.name}" referrerpolicy="no-referrer" loading="lazy" onerror="handleItemImageError(this)">`
      : DEFAULT_ITEM_SVG;

    const isHighlighted = isFilteringByItem && isItemMatch(item, qTop);

    html += `
      <tr class="${isHighlighted ? 'item-row-highlight' : ''}">
        <td>
          <div class="item-cell">
            <div class="item-thumb">
              ${itemThumbHtml}
            </div>
            <span class="item-name">
              ${item.name}
              ${isHighlighted ? '<span class="badge-match-inline">★ Buscado</span>' : ''}
            </span>
          </div>
        </td>
        <td>
          <span class="price-tag">
            <span class="coin-icon"></span>
            ${formatNumber(item.price)} ${item.currency || 'gp'}
          </span>
        </td>
        <td style="color: var(--text-dim); font-size: 0.85rem;">
          ${item.notes || '-'}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Formateador de números (10,000 gp)
function formatNumber(num) {
  return Number(num).toLocaleString('en-US');
}

// ==========================================
// FLUJO DEL SCRAPER (EXTRACCIÓN WEB)
// ==========================================
async function handleRunScrape() {
  const inputEl = document.getElementById('scraper-input-url');
  const query = inputEl.value.trim();
  if (!query) {
    showToast('Ingresa un nombre de NPC o una URL para raspar', 'error');
    inputEl.focus();
    return;
  }

  const statusBox = document.getElementById('scraper-status-box');
  const statusMsg = document.getElementById('scraper-status-msg');
  const previewBox = document.getElementById('scraper-preview-box');
  const btnSave = document.getElementById('btn-save-scraped');

  statusBox.style.display = 'flex';
  previewBox.style.display = 'none';
  btnSave.style.display = 'none';

  try {
    const result = await TibiaScraper.scrapeNpc(query, (progressMsg) => {
      statusMsg.textContent = progressMsg;
    });

    AppState.tempScrapedNpc = result;

    // Mostrar preview
    statusBox.style.display = 'none';
    previewBox.style.display = 'flex';
    btnSave.style.display = 'inline-flex';

    document.getElementById('preview-npc-name').textContent = result.name;
    document.getElementById('preview-npc-location').textContent = `${result.city || 'Desconocida'} (${result.location || '-'})`;
    document.getElementById('preview-npc-job').textContent = result.job || 'No especificado';
    document.getElementById('preview-npc-coords').textContent = result.coordinates.x ? `X: ${result.coordinates.x}, Y: ${result.coordinates.y}, Z: ${result.coordinates.z}` : 'No detectadas';
    document.getElementById('preview-npc-counts').textContent = `${result.itemsSells.length} para venta, ${result.itemsBuys.length} para compra`;

    const avatarBox = document.getElementById('preview-avatar');
    let previewAvatar = result.imageUrl;
    if (previewAvatar && (previewAvatar.includes('NPC_Bubble_') || previewAvatar.startsWith('data:image'))) {
      previewAvatar = '';
    }
    if (!previewAvatar && result.name && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
      previewAvatar = TibiaScraper.getFandomItemIconUrl(result.name);
    }
    if (previewAvatar) {
      avatarBox.innerHTML = `<img src="${previewAvatar}" data-src="${previewAvatar}" alt="${result.name}" referrerpolicy="no-referrer" onerror="handleAvatarImageError(this)">`;
    } else {
      avatarBox.innerHTML = DEFAULT_AVATAR_SVG;
    }

    showToast(`¡Datos de ${result.name} extraídos con éxito!`, 'success');
  } catch (err) {
    statusBox.style.display = 'none';
    showToast(`Error al raspar: ${err.message}`, 'error');
  }
}


// Guardar NPC raspado en la base de datos
function handleSaveScrapedNpc() {
  if (!AppState.tempScrapedNpc) return;

  const npc = AppState.tempScrapedNpc;

  // Comprobar si ya existe por nombre
  const existingIndex = AppState.npcs.findIndex(n => n.name.toLowerCase() === npc.name.toLowerCase());

  if (existingIndex !== -1) {
    const overwrite = confirm(`El NPC "${npc.name}" ya existe en tu lista. ¿Deseas actualizar sus datos?`);
    if (overwrite) {
      npc.id = AppState.npcs[existingIndex].id;
      AppState.npcs[existingIndex] = npc;
      showToast(`NPC "${npc.name}" actualizado`, 'success');
    } else {
      return;
    }
  } else {
    AppState.npcs.unshift(npc);
    showToast(`NPC "${npc.name}" agregado a la lista`, 'success');
  }

  AppState.selectedNpcId = npc.id;
  saveToStorage();
  closeModal('modal-scraper');
  renderApp();
}

// ==========================================
// SINCRONIZACIÓN MASIVA CON TIBIAWIKI (UPDATES)
// ==========================================
let isBatchUpdating = false;
let cancelBatchRequested = false;

// ==========================================
// UTILIDADES PARA REPORTES DE ERRORES DE ACTUALIZACIÓN
// ==========================================
async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('Clipboard API fallo, usando fallback:', e);
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err);
    return false;
  }
}

function downloadTextAsFile(filename, text) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Error al descargar archivo de reporte:', e);
  }
}

function generateErrorReportSummaryText(title, meta = {}) {
  const lines = [
    '======================================================================',
    `REPORTE DE ERRORES - ${title.toUpperCase()}`,
    `Fecha y Hora: ${new Date().toLocaleString()}`,
    '----------------------------------------------------------------------',
    `Total Procesados: ${meta.total || 0}`,
    `Exitosos: ${meta.successCount || 0}`,
    `Fallidos / Con Error: ${meta.errorCount || 0}`
  ];
  if (meta.extraInfo) lines.push(meta.extraInfo);
  lines.push('======================================================================');
  lines.push('LISTA DETALLADA DE ELEMENTOS CON ERROR:');
  lines.push('');

  const failedItems = meta.failedItems || [];
  if (failedItems.length === 0) {
    lines.push('✓ No se registraron errores durante la actualización.');
  } else {
    failedItems.forEach((item, idx) => {
      lines.push(`[${idx + 1}] ${item.name} (${item.time || ''})`);
      lines.push(`    Motivo: ${item.error || 'Error desconocido'}`);
      lines.push('');
    });
  }

  lines.push('======================================================================');
  lines.push('Generado automáticamente por Tibia Tracker Alaska');
  lines.push('======================================================================');
  return lines.join('\r\n');
}

function renderBatchUpdateErrorReport(failedNpcs, totalProcessed, totalNewItems, totalUpdatedPrices) {
  const errorBox = document.getElementById('batch-errors-report-box');
  const errorsCard = document.getElementById('batch-final-errors-card');
  const errorsCountEl = document.getElementById('batch-final-errors');
  const finishIcon = document.getElementById('batch-finish-icon');
  const finishTitle = document.getElementById('batch-finish-title');
  const finishDesc = document.getElementById('batch-finish-desc');

  if (errorsCard) errorsCard.style.display = failedNpcs.length > 0 ? 'block' : 'none';
  if (errorsCountEl) errorsCountEl.textContent = failedNpcs.length;

  if (failedNpcs.length === 0) {
    if (finishIcon) finishIcon.textContent = '🎉';
    if (finishTitle) finishTitle.textContent = cancelBatchRequested ? 'Sincronización Detenida' : '¡Sincronización Completada con Éxito!';
    if (finishDesc) finishDesc.textContent = 'Todos los NPCs han sido actualizados con los últimos datos de TibiaWiki sin errores.';
    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.innerHTML = '';
    }
    return;
  }

  // Hay errores registrados
  if (finishIcon) finishIcon.textContent = '⚠️';
  if (finishTitle) finishTitle.textContent = cancelBatchRequested ? 'Sincronización Detenida (con fallos)' : `⚠️ Sincronización Finalizada con Errores (${failedNpcs.length})`;
  if (finishDesc) finishDesc.textContent = `Se procesaron los datos, pero ${failedNpcs.length} NPC(s) tuvieron fallos al consultar la Wiki. Revisa el reporte abajo:`;

  if (!errorBox) return;
  errorBox.style.display = 'block';

  const itemsHtml = failedNpcs.map((item, idx) => `
    <div class="updater-error-item" id="batch-err-item-${idx}">
      <div class="updater-error-item-left">
        <div class="updater-error-item-avatar">
          ${item.avatar ? `<img src="${item.avatar}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.parentElement.innerHTML='👤';">` : '👤'}
        </div>
        <div class="updater-error-item-info">
          <div class="updater-error-item-name">${escapeHtml(item.name)} <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 400;">(${item.time})</span></div>
          <div class="updater-error-item-msg" title="${escapeHtml(item.error)}">⚠️ ${escapeHtml(item.error)}</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-error-item-retry" data-batch-retry-name="${escapeHtml(item.name)}" data-batch-retry-idx="${idx}">
          🔄 Reintentar
        </button>
      </div>
    </div>
  `).join('');

  errorBox.innerHTML = `
    <div class="updater-error-report-card">
      <div class="updater-error-header">
        <div class="updater-error-title-wrap">
          <span style="font-size: 1.15rem;">📋</span>
          <strong style="color: #f87171; font-size: 0.95rem;">Reporte Detallado de Errores</strong>
          <span class="updater-error-badge-count">${failedNpcs.length} fallos</span>
        </div>
        <div class="updater-error-actions">
          <button type="button" class="btn-error-action btn-error-copy" id="btn-copy-batch-errors-report" title="Copiar informe al portapapeles">
            📋 Copiar Reporte
          </button>
          <button type="button" class="btn-error-action btn-error-copy" id="btn-export-batch-errors-log" title="Guardar informe como archivo de texto">
            💾 Guardar Log
          </button>
          <button type="button" class="btn-error-action btn-error-retry-all" id="btn-retry-all-batch-errors" title="Reintentar únicamente los NPCs que fallaron">
            🔄 Reintentar Fallidos (${failedNpcs.length})
          </button>
        </div>
      </div>
      <div class="updater-error-list" id="batch-error-items-list">
        ${itemsHtml}
      </div>
    </div>
  `;

  // Asignar listeners
  const btnCopy = document.getElementById('btn-copy-batch-errors-report');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      const summaryText = generateErrorReportSummaryText('Sincronización de NPCs (TibiaWiki)', {
        total: totalProcessed,
        successCount: totalProcessed - failedNpcs.length,
        errorCount: failedNpcs.length,
        extraInfo: `Items Nuevos: ${totalNewItems} | Precios Actualizados: ${totalUpdatedPrices}`,
        failedItems: failedNpcs
      });
      const ok = await copyTextToClipboard(summaryText);
      if (ok) {
        showToast('📋 Reporte de errores de NPCs copiado al portapapeles', 'success');
        btnCopy.textContent = '✓ Copiado';
        setTimeout(() => { btnCopy.textContent = '📋 Copiar Reporte'; }, 2000);
      }
    });
  }

  const btnExport = document.getElementById('btn-export-batch-errors-log');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const summaryText = generateErrorReportSummaryText('Sincronización de NPCs (TibiaWiki)', {
        total: totalProcessed,
        successCount: totalProcessed - failedNpcs.length,
        errorCount: failedNpcs.length,
        extraInfo: `Items Nuevos: ${totalNewItems} | Precios Actualizados: ${totalUpdatedPrices}`,
        failedItems: failedNpcs
      });
      downloadTextAsFile(`reporte_errores_npcs_${Date.now()}.txt`, summaryText);
      showToast('💾 Archivo de reporte descargado', 'info');
    });
  }

  const btnRetryAll = document.getElementById('btn-retry-all-batch-errors');
  if (btnRetryAll) {
    btnRetryAll.addEventListener('click', () => {
      const failedList = failedNpcs.map(f => f.npc || { name: f.name });
      startBatchUpdate(failedList);
    });
  }

  // Listeners individuales
  errorBox.querySelectorAll('[data-batch-retry-name]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-batch-retry-name');
      const idx = btn.getAttribute('data-batch-retry-idx');
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      try {
        const scraped = await TibiaScraper.scrapeNpc(name);
        if (scraped) {
          const itemRow = document.getElementById(`batch-err-item-${idx}`);
          if (itemRow) {
            itemRow.classList.add('is-resolved');
            const msgEl = itemRow.querySelector('.updater-error-item-msg');
            if (msgEl) {
              msgEl.style.color = '#4ade80';
              msgEl.textContent = '✓ Sincronizado correctamente';
            }
          }
          btn.textContent = '✓ Listo';
          btn.style.borderColor = '#4ade80';
          btn.style.color = '#4ade80';
          showToast(`✓ NPC "${name}" actualizado con éxito`, 'success');
        }
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '🔄 Reintentar';
        showToast(`Error al reintentar "${name}": ${e.message}`, 'error');
      }
    });
  });
}

function openBatchUpdateModal() {
  const readyStep = document.getElementById('batch-step-ready');
  const runningStep = document.getElementById('batch-step-running');
  const finishedStep = document.getElementById('batch-step-finished');

  if (readyStep) readyStep.style.display = 'block';
  if (runningStep) runningStep.style.display = 'none';
  if (finishedStep) finishedStep.style.display = 'none';

  const btnCancelBatch = document.getElementById('btn-cancel-batch');
  if (btnCancelBatch) {
    btnCancelBatch.textContent = '🛑 Detener Sincronización';
    btnCancelBatch.disabled = false;
  }

  const eligible = AppState.npcs.filter(n => n.sourceUrl || n.name);
  const countEl = document.getElementById('batch-total-npcs-count');
  if (countEl) countEl.textContent = eligible.length;

  openModal('modal-batch-update');
}

async function startBatchUpdate(customTargetList = null) {
  if (isBatchUpdating) return;
  isBatchUpdating = true;
  cancelBatchRequested = false;

  const readyStep = document.getElementById('batch-step-ready');
  const runningStep = document.getElementById('batch-step-running');
  const finishedStep = document.getElementById('batch-step-finished');

  if (readyStep) readyStep.style.display = 'none';
  if (runningStep) runningStep.style.display = 'flex';
  if (finishedStep) finishedStep.style.display = 'none';

  const updatePrices = document.getElementById('batch-opt-update-prices')?.checked ?? true;
  const eligibleNpcs = (customTargetList && Array.isArray(customTargetList) && customTargetList.length > 0)
    ? customTargetList
    : AppState.npcs.filter(n => n.sourceUrl || n.name);
  const total = eligibleNpcs.length;

  let processedCount = 0;
  let totalNewItems = 0;
  let totalUpdatedPrices = 0;
  const newItemsDetails = [];
  const updatedPricesDetails = [];
  const failedNpcs = [];
  const startTime = Date.now();

  const progressBar = document.getElementById('batch-progress-bar');
  const progressPct = document.getElementById('batch-progress-pct');
  const progressFraction = document.getElementById('batch-progress-fraction');
  const currentAvatar = document.getElementById('batch-current-avatar');
  const currentName = document.getElementById('batch-current-name');
  const currentStatus = document.getElementById('batch-current-status');
  const logBox = document.getElementById('batch-log-box');
  const statNewItems = document.getElementById('batch-stat-new-items');
  const statUpdatedPrices = document.getElementById('batch-stat-updated-prices');
  const statEta = document.getElementById('batch-stat-eta');

  if (logBox) logBox.innerHTML = '';
  if (progressBar) progressBar.style.width = '0%';
  if (progressPct) progressPct.textContent = '0%';
  if (progressFraction) progressFraction.textContent = `0 / ${total}`;
  if (statNewItems) statNewItems.textContent = '0';
  if (statUpdatedPrices) statUpdatedPrices.textContent = '0';
  if (statEta) statEta.textContent = `~${Math.round(total * 0.4)}s`;

  function appendLog(text, type = '') {
    if (!logBox) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `batch-log-line ${type}`;
    line.textContent = `[${time}] ${text}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  appendLog(`Iniciando sincronización de ${total} NPCs con TibiaWiki...`, 'highlight');

  for (let i = 0; i < total; i++) {
    if (cancelBatchRequested) {
      appendLog('Sincronización detenida por el usuario.', 'error');
      break;
    }

    const npc = eligibleNpcs[i];
    processedCount++;

    if (currentName) currentName.textContent = npc.name;
    if (currentStatus) currentStatus.textContent = 'Descargando datos oficiales de la Wiki...';
    if (currentAvatar) {
      if (npc.imageUrl) {
        currentAvatar.innerHTML = `<img src="${npc.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='';">`;
      } else {
        currentAvatar.innerHTML = DEFAULT_AVATAR_SVG;
      }
    }

    const pct = Math.round((processedCount / total) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (progressFraction) progressFraction.textContent = `${processedCount} / ${total}`;

    const elapsed = Date.now() - startTime;
    const avgTimePerNpc = elapsed / processedCount;
    const remainingNpcs = total - processedCount;
    const remainingSec = Math.max(1, Math.round((remainingNpcs * avgTimePerNpc) / 1000));
    if (statEta) statEta.textContent = remainingNpcs > 0 ? `~${remainingSec}s` : 'Listo';

    try {
      const query = npc.sourceUrl || npc.name;
      const scraped = await TibiaScraper.scrapeNpc(query);

      let npcNewItems = 0;
      let npcUpdatedPrices = 0;

      // Smart Merge para buys (Lo que compra)
      const buysMap = new Map();
      (npc.itemsBuys || []).forEach(item => {
        if (item && item.name) buysMap.set(item.name.toLowerCase().trim(), item);
      });
      const mergedBuys = [...(npc.itemsBuys || [])];

      (scraped.itemsBuys || []).forEach(newItem => {
        if (!newItem || !newItem.name) return;
        const key = newItem.name.toLowerCase().trim();
        if (buysMap.has(key)) {
          const current = buysMap.get(key);
          if (updatePrices && newItem.price && newItem.price !== current.price) {
            updatedPricesDetails.push({
              npcName: npc.name,
              itemName: newItem.name,
              type: 'buys',
              oldPrice: current.price,
              newPrice: newItem.price,
              currency: newItem.currency || current.currency || 'gp',
              icon: newItem.icon || current.icon
            });
            current.price = newItem.price;
            npcUpdatedPrices++;
          }
          if (newItem.icon && !current.icon) {
            current.icon = newItem.icon;
          }
        } else {
          mergedBuys.push(newItem);
          buysMap.set(key, newItem);
          newItemsDetails.push({
            npcName: npc.name,
            itemName: newItem.name,
            type: 'buys',
            price: newItem.price,
            currency: newItem.currency || 'gp',
            icon: newItem.icon
          });
          npcNewItems++;
        }
      });

      // Smart Merge para sells (Lo que vende)
      const sellsMap = new Map();
      (npc.itemsSells || []).forEach(item => {
        if (item && item.name) sellsMap.set(item.name.toLowerCase().trim(), item);
      });
      const mergedSells = [...(npc.itemsSells || [])];

      (scraped.itemsSells || []).forEach(newItem => {
        if (!newItem || !newItem.name) return;
        const key = newItem.name.toLowerCase().trim();
        if (sellsMap.has(key)) {
          const current = sellsMap.get(key);
          if (updatePrices && newItem.price && newItem.price !== current.price) {
            updatedPricesDetails.push({
              npcName: npc.name,
              itemName: newItem.name,
              type: 'sells',
              oldPrice: current.price,
              newPrice: newItem.price,
              currency: newItem.currency || current.currency || 'gp',
              icon: newItem.icon
            });
            current.price = newItem.price;
            npcUpdatedPrices++;
          }
          if (newItem.icon && !current.icon) {
            current.icon = newItem.icon;
          }
        } else {
          mergedSells.push(newItem);
          sellsMap.set(key, newItem);
          newItemsDetails.push({
            npcName: npc.name,
            itemName: newItem.name,
            type: 'sells',
            price: newItem.price,
            currency: newItem.currency || 'gp',
            icon: newItem.icon
          });
          npcNewItems++;
        }
      });

      npc.itemsBuys = mergedBuys;
      npc.itemsSells = mergedSells;

      if (!npc.imageUrl && scraped.imageUrl) {
        npc.imageUrl = scraped.imageUrl;
      }
      if (!npc.sourceUrl && scraped.sourceUrl) {
        npc.sourceUrl = scraped.sourceUrl;
      }

      totalNewItems += npcNewItems;
      totalUpdatedPrices += npcUpdatedPrices;

      if (statNewItems) statNewItems.textContent = totalNewItems;
      if (statUpdatedPrices) statUpdatedPrices.textContent = totalUpdatedPrices;

      if (npcNewItems > 0 || npcUpdatedPrices > 0) {
        appendLog(`✓ ${npc.name}: +${npcNewItems} items nuevos, ${npcUpdatedPrices} precios act.`, 'success');
      } else {
        appendLog(`✓ ${npc.name}: Al día (sin cambios)`, '');
      }

    } catch (err) {
      failedNpcs.push({
        name: npc.name,
        error: err.message || 'Error desconocido al consultar la Wiki',
        time: new Date().toLocaleTimeString(),
        avatar: npc.imageUrl,
        npc
      });
      appendLog(`⚠️ Error con ${npc.name}: ${err.message}`, 'error');
    }

    // Pequeña pausa respetuosa de 250ms entre llamadas para no saturar Fandom
    await new Promise(r => setTimeout(r, 250));
  }

  // Guardar datos persistentes
  await saveToStorage();
  renderApp();

  isBatchUpdating = false;

  // Mostrar resumen final
  if (runningStep) runningStep.style.display = 'none';
  if (finishedStep) finishedStep.style.display = 'flex';

  const finalTotal = document.getElementById('batch-final-total-npcs');
  const finalNew = document.getElementById('batch-final-new-items');
  const finalPrices = document.getElementById('batch-final-updated-prices');

  if (finalTotal) finalTotal.textContent = processedCount;
  if (finalNew) finalNew.textContent = totalNewItems;
  if (finalPrices) finalPrices.textContent = totalUpdatedPrices;

  // Renderizar detalle de items nuevos y precios modificados
  const changesContainer = document.getElementById('batch-changes-container');
  if (changesContainer) {
    if (newItemsDetails.length === 0 && updatedPricesDetails.length === 0) {
      changesContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 0.85rem 0; font-size: 0.85rem;">
          ✨ No hubo items nuevos ni variaciones de precios; tu base de datos ya estaba 100% al día con la Wiki oficial.
        </div>
      `;
    } else {
      let changesHtml = '';

      if (newItemsDetails.length > 0) {
        changesHtml += `
          <div style="font-size: 0.82rem; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
            <span>📦 Items Nuevos Agregados (${newItemsDetails.length}):</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
        `;

        newItemsDetails.forEach(item => {
          const iconHtml = item.icon
            ? `<img src="${item.icon}" style="width: 22px; height: 22px; object-fit: contain;" onerror="this.src='';">`
            : DEFAULT_ITEM_SVG;
          const badgeType = item.type === 'buys' 
            ? `<span style="font-size: 0.68rem; background: rgba(74, 222, 128, 0.15); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); padding: 0.1rem 0.4rem; border-radius: 4px;">Compra</span>`
            : `<span style="font-size: 0.68rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.1rem 0.4rem; border-radius: 4px;">Vende</span>`;

          changesHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); font-size: 0.82rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                  ${iconHtml}
                </div>
                <div>
                  <strong style="color: var(--text-main);">${escapeHtml(item.itemName)}</strong>
                  <span style="color: var(--text-dim); font-size: 0.75rem; margin-left: 0.3rem;">(en ${escapeHtml(item.npcName)})</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${badgeType}
                <span style="font-weight: 700; color: var(--gold-light);">${formatNumber(item.price)} ${item.currency}</span>
              </div>
            </div>
          `;
        });

        changesHtml += `</div>`;
      }

      if (updatedPricesDetails.length > 0) {
        changesHtml += `
          <div style="font-size: 0.82rem; font-weight: 700; color: #4ade80; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.6rem;">
            <span>💰 Precios Modificados (${updatedPricesDetails.length}):</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
        `;

        updatedPricesDetails.forEach(item => {
          const iconHtml = item.icon
            ? `<img src="${item.icon}" style="width: 22px; height: 22px; object-fit: contain;" onerror="this.src='';">`
            : DEFAULT_ITEM_SVG;

          changesHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); font-size: 0.82rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
                  ${iconHtml}
                </div>
                <div>
                  <strong style="color: var(--text-main);">${escapeHtml(item.itemName)}</strong>
                  <span style="color: var(--text-dim); font-size: 0.75rem; margin-left: 0.3rem;">(en ${escapeHtml(item.npcName)})</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem;">
                <span style="color: var(--text-dim); text-decoration: line-through;">${formatNumber(item.oldPrice)}</span>
                <span style="color: #4ade80; font-weight: 700;">➔ ${formatNumber(item.newPrice)} ${item.currency}</span>
              </div>
            </div>
          `;
        });

        changesHtml += `</div>`;
      }

      changesContainer.innerHTML = changesHtml;
    }
  }

  // Renderizar Reporte de Errores al final de la actualización si hubo fallos
  renderBatchUpdateErrorReport(failedNpcs, processedCount, totalNewItems, totalUpdatedPrices);

  if (failedNpcs.length > 0) {
    showToast(`⚠️ Sincronización finalizada con ${failedNpcs.length} error(es). Revisa el reporte.`, 'warning', 4500);
  } else {
    showToast(`✓ Sincronización finalizada: ${totalNewItems} items nuevos agregados.`, 'success');
  }
}

// ==========================================
// FORMULARIO MANUAL DE NPC (CREAR / EDITAR)
// ==========================================
function openNpcFormModal(npcToEdit = null) {
  const modalTitle = document.getElementById('form-modal-title');
  const formId = document.getElementById('form-npc-id');
  const formName = document.getElementById('form-name');
  const formCity = document.getElementById('form-city');
  const formJob = document.getElementById('form-job');
  const formImage = document.getElementById('form-image');
  const formLocation = document.getElementById('form-location');
  const formCoordX = document.getElementById('form-coord-x');
  const formCoordY = document.getElementById('form-coord-y');
  const formCoordZ = document.getElementById('form-coord-z');
  const formItemsSells = document.getElementById('form-items-sells');
  const formItemsBuys = document.getElementById('form-items-buys');

  if (npcToEdit) {
    modalTitle.textContent = `Editar NPC: ${npcToEdit.name}`;
    formId.value = npcToEdit.id;
    formName.value = npcToEdit.name || '';
    formCity.value = npcToEdit.city || '';
    formJob.value = npcToEdit.job || '';
    formImage.value = npcToEdit.imageUrl || '';
    formLocation.value = npcToEdit.location || '';
    formCoordX.value = npcToEdit.coordinates?.x || '';
    formCoordY.value = npcToEdit.coordinates?.y || '';
    formCoordZ.value = npcToEdit.coordinates?.z || '7';

    // Convertir arrays a formato texto línea por línea
    formItemsSells.value = (npcToEdit.itemsSells || [])
      .map(item => `${item.name}, ${item.price}`)
      .join('\n');

    formItemsBuys.value = (npcToEdit.itemsBuys || [])
      .map(item => `${item.name}, ${item.price}`)
      .join('\n');
  } else {
    modalTitle.textContent = 'Registrar Nuevo NPC';
    formId.value = '';
    formName.value = '';
    formCity.value = '';
    formJob.value = '';
    formImage.value = '';
    formLocation.value = '';
    formCoordX.value = '';
    formCoordY.value = '';
    formCoordZ.value = '7';
    formItemsSells.value = '';
    formItemsBuys.value = '';
  }

  openModal('modal-npc-form');
}

function handleSaveNpcForm() {
  const formId = document.getElementById('form-npc-id').value;
  const name = document.getElementById('form-name').value.trim();
  const city = document.getElementById('form-city').value.trim();
  const job = document.getElementById('form-job').value.trim();
  const imageUrl = document.getElementById('form-image').value.trim();
  const location = document.getElementById('form-location').value.trim();
  const coordX = document.getElementById('form-coord-x').value.trim();
  const coordY = document.getElementById('form-coord-y').value.trim();
  const coordZ = document.getElementById('form-coord-z').value.trim() || '7';

  if (!name) {
    showToast('El nombre del NPC es obligatorio', 'error');
    document.getElementById('form-name').focus();
    return;
  }

  // Parsear listas de items de texto a objetos
  const sellsText = document.getElementById('form-items-sells').value.trim();
  const buysText = document.getElementById('form-items-buys').value.trim();

  const parseItemList = (text) => {
    if (!text) return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const parts = line.split(',');
        const itemName = parts[0]?.trim();
        const price = parseInt((parts[1] || '0').replace(/[^\d]/g, ''), 10) || 0;
        return {
          name: itemName,
          price: price,
          currency: 'gp',
          notes: '',
          icon: ''
        };
      })
      .filter(item => item.name);
  };

  const itemsSells = parseItemList(sellsText);
  const itemsBuys = parseItemList(buysText);

  let targetId = formId;

  if (formId) {
    // Edición
    const index = AppState.npcs.findIndex(n => n.id === formId);
    if (index !== -1) {
      AppState.npcs[index] = {
        ...AppState.npcs[index],
        name,
        city: city || 'Sin ciudad asignada',
        job: job || 'Comerciante',
        imageUrl,
        location: location || city,
        coordinates: { x: coordX, y: coordY, z: coordZ },
        mapUrl: coordX && coordY ? `https://tibiamaps.io/map#${coordX},${coordY},${coordZ}:2` : '',
        itemsSells,
        itemsBuys,
        updatedAt: new Date().toISOString()
      };
      showToast(`NPC "${name}" actualizado`, 'success');
    }
  } else {
    // Creación
    targetId = 'npc_' + Date.now();
    const newNpc = {
      id: targetId,
      name,
      city: city || 'Sin ciudad asignada',
      job: job || 'Comerciante',
      imageUrl,
      location: location || city,
      coordinates: { x: coordX, y: coordY, z: coordZ },
      mapUrl: coordX && coordY ? `https://tibiamaps.io/map#${coordX},${coordY},${coordZ}:2` : '',
      itemsSells,
      itemsBuys,
      sourceUrl: '',
      updatedAt: new Date().toISOString()
    };
    AppState.npcs.unshift(newNpc);
    showToast(`NPC "${name}" registrado exitosamente`, 'success');
  }

  AppState.selectedNpcId = targetId;
  saveToStorage();
  closeModal('modal-npc-form');
  renderApp();
}

// ==========================================
// REGISTRO DE CIUDADES DE TIBIA
// ==========================================
const TIBIA_OFFICIAL_CITIES = [
  'Ab\'Dendriel', 'Ankrahmun', 'Bounac', 'Carlin', 'Darashia', 'Dawnport',
  'Edron', 'Farmine', 'Feyrist', 'Gray Beach', 'Issavi', 'Kazordoon',
  'Liberty Bay', 'Marapur', 'Port Hope', 'Rathleton', 'Rookgaard',
  'Roshamuul', 'Svargrond', 'Thais', 'Venore', 'Yalahar'
];

function getCustomCities() {
  try {
    const raw = localStorage.getItem('tibia_custom_cities_v1');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCustomCity(newCity) {
  if (!newCity || typeof newCity !== 'string') return false;
  const clean = newCity.trim();
  if (!clean) return false;

  const list = getCustomCities();
  const exists = TIBIA_OFFICIAL_CITIES.some(c => c.toLowerCase() === clean.toLowerCase()) ||
                 list.some(c => c.toLowerCase() === clean.toLowerCase());

  if (!exists) {
    list.push(clean);
    localStorage.setItem('tibia_custom_cities_v1', JSON.stringify(list));
    return true;
  }
  return false;
}

function getAllCities() {
  const custom = getCustomCities();
  const all = [...TIBIA_OFFICIAL_CITIES];

  custom.forEach(c => {
    if (!all.some(existing => existing.toLowerCase() === c.toLowerCase())) {
      all.push(c);
    }
  });

  // Agregar también cualquier ciudad existente en los NPCs de la base de datos
  AppState.npcs.forEach(npc => {
    if (isRashidNpc(npc)) return;
    if (npc.city) {
      npc.city.split(',').forEach(part => {
        const clean = part.trim();
        if (clean && !clean.toLowerCase().includes('itinerante') && !all.some(existing => existing.toLowerCase() === clean.toLowerCase())) {
          all.push(clean);
        }
      });
    }
  });

  return all.sort((a, b) => a.localeCompare(b));
}

function updateCityFilterOptions() {
  const select = document.getElementById('filter-city');
  if (!select) return;

  const currentVal = AppState.cityFilter || '';
  const cities = getAllCities();

  let html = '<option value="">Todas las Ciudades</option>';
  cities.forEach(city => {
    const isSelected = currentVal && currentVal.toLowerCase() === city.toLowerCase();
    html += `<option value="${city}" ${isSelected ? 'selected' : ''}>${city}</option>`;
  });

  select.innerHTML = html;

  if (typeof window.updateClearCityVisibility === 'function') {
    window.updateClearCityVisibility();
  }
}

// ==========================================
// MODAL DE EDICIÓN DE UBICACIÓN Y CIUDADES
// ==========================================
function openEditLocationModal(npc) {
  if (!npc) return;

  const avatarBox = document.getElementById('edit-loc-npc-avatar');
  if (avatarBox) {
    if (npc.imageUrl) {
      avatarBox.innerHTML = `<img src="${npc.imageUrl}" alt="${npc.name}" onerror="handleAvatarImageError(this)">`;
    } else {
      avatarBox.innerHTML = DEFAULT_AVATAR_SVG;
    }
  }

  const nameEl = document.getElementById('edit-loc-npc-name');
  if (nameEl) nameEl.textContent = npc.name;

  const citiesInput = document.getElementById('edit-loc-cities');
  if (citiesInput) {
    const raw = (npc.city || '').trim();
    const cleanList = raw.split(',').map(s => s.trim()).filter(Boolean)
      .filter(c => !c.toLowerCase().includes('sin ciudad') && c.toLowerCase() !== 'desconocida' && c.toLowerCase() !== 'sin asignar');
    citiesInput.value = cleanList.join(', ');
  }

  const descInput = document.getElementById('edit-loc-desc');
  if (descInput) descInput.value = (npc.location && npc.location !== npc.city) ? npc.location : '';

  const newCityInput = document.getElementById('input-new-custom-city');
  if (newCityInput) newCityInput.value = '';

  renderCityChips();

  openModal('modal-edit-location');
  setTimeout(() => citiesInput?.focus(), 150);
}

function renderCityChips() {
  const container = document.getElementById('edit-loc-quick-cities');
  const citiesInput = document.getElementById('edit-loc-cities');
  if (!container || !citiesInput) return;

  const currentCityTokens = citiesInput.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const cities = getAllCities();

  let html = '';
  cities.forEach(city => {
    const isSelected = currentCityTokens.includes(city.toLowerCase()) || 
                       citiesInput.value.toLowerCase().includes(city.toLowerCase());

    html += `
      <button type="button" class="city-chip ${isSelected ? 'selected' : ''}" data-city="${city}">
        ${isSelected ? '✓ ' : '+ '}${city}
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.city-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const city = btn.getAttribute('data-city');
      toggleCityInInput(city);
    });
  });
}

function toggleCityInInput(city) {
  const citiesInput = document.getElementById('edit-loc-cities');
  if (!citiesInput) return;

  // Filtrar automáticamente cualquier texto previo de "Sin ciudad asignada" para que al seleccionar se elimine inmediatamente
  let currentList = citiesInput.value.split(',').map(s => s.trim()).filter(Boolean)
    .filter(c => !c.toLowerCase().includes('sin ciudad') && c.toLowerCase() !== 'desconocida' && c.toLowerCase() !== 'sin asignar');

  const cityIndex = currentList.findIndex(c => c.toLowerCase() === city.toLowerCase());

  if (cityIndex !== -1) {
    currentList.splice(cityIndex, 1);
  } else {
    currentList.push(city);
  }

  citiesInput.value = currentList.join(', ');
  renderCityChips();
}

function handleAddCustomCity() {
  const input = document.getElementById('input-new-custom-city');
  if (!input) return;
  const val = input.value.trim();
  if (!val) {
    input.focus();
    return;
  }

  saveCustomCity(val);

  // Añadir la ciudad directamente al campo del NPC
  const citiesInput = document.getElementById('edit-loc-cities');
  if (citiesInput) {
    let currentList = citiesInput.value.split(',').map(s => s.trim()).filter(Boolean)
      .filter(c => !c.toLowerCase().includes('sin ciudad') && c.toLowerCase() !== 'desconocida' && c.toLowerCase() !== 'sin asignar');
    if (!currentList.some(c => c.toLowerCase() === val.toLowerCase())) {
      currentList.push(val);
      citiesInput.value = currentList.join(', ');
    }
  }

  input.value = '';
  renderCityChips();
  updateCityFilterOptions();
  showToast(`Ciudad "${val}" agregada exitosamente`, 'success');
}

async function handleSaveLocation() {
  const selectedNpc = AppState.npcs.find(n => n.id === AppState.selectedNpcId);
  if (!selectedNpc) return;

  const citiesInput = document.getElementById('edit-loc-cities');
  const descInput = document.getElementById('edit-loc-desc');

  const rawCity = citiesInput ? citiesInput.value.trim() : '';
  const cleanList = rawCity.split(',').map(s => s.trim()).filter(Boolean)
    .filter(c => !c.toLowerCase().includes('sin ciudad') && c.toLowerCase() !== 'desconocida' && c.toLowerCase() !== 'sin asignar');
  const newCity = cleanList.join(', ');
  const newDesc = descInput ? descInput.value.trim() : '';

  selectedNpc.city = newCity;
  selectedNpc.location = newDesc || (selectedNpc.city || '');
  selectedNpc.updatedAt = new Date().toISOString();

  await saveToStorage();
  updateCityFilterOptions();
  closeModal('modal-edit-location');
  renderApp();
  showToast(`Ubicación de "${selectedNpc.name}" guardada con éxito`, 'success');
}

// ==========================================
// ELIMINACIÓN DE NPC CON CAPTCHA
// ==========================================
let deleteTargetNpcId = null;
let currentCaptchaCode = '';

function generateCaptchaCode(length = 5) {
  // Caracteres seguros sin ambigüedad visual (sin 0, O, 1, I, etc.)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function drawCaptcha(code, canvasId = 'delete-captcha-canvas') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Fondo estilizado con gradiente oscuro
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#090d16');
  grad.addColorStop(1, '#162030');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Paleta de colores temáticos de Tibia
  const colors = ['#e5b93b', '#38bdf8', '#ef4444', '#10b981', '#f59e0b', '#c084fc', '#f472b6'];

  // Líneas curvas de interferencia
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height
    );
    ctx.stroke();
  }

  // Puntos de ruido dispersos
  for (let i = 0; i < 45; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dibujar cada letra con rotación, escala y color individual
  ctx.globalAlpha = 1.0;
  const charSpacing = width / (code.length + 1);
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    ctx.save();
    const x = charSpacing * (i + 0.85) + (Math.random() * 6 - 3);
    const y = (height / 2) + 2 + (Math.random() * 6 - 3);
    ctx.translate(x, y);

    const angle = (Math.random() * 36 - 18) * (Math.PI / 180);
    ctx.rotate(angle);

    ctx.font = `bold ${24 + Math.floor(Math.random() * 5)}px 'Cinzel', 'Courier New', monospace`;
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }
}

function openDeleteCaptchaModal(id) {
  const npc = AppState.npcs.find(n => n.id === id);
  if (!npc) return;

  deleteTargetNpcId = id;
  currentCaptchaCode = generateCaptchaCode(5);

  // Llenar vista previa del NPC en el modal
  const avatarBox = document.getElementById('delete-captcha-npc-avatar');
  if (avatarBox) {
    if (npc.imageUrl) {
      avatarBox.innerHTML = `<img src="${npc.imageUrl}" alt="${npc.name}" onerror="handleAvatarImageError(this)">`;
    } else {
      avatarBox.innerHTML = DEFAULT_AVATAR_SVG;
    }
  }

  const nameEl = document.getElementById('delete-captcha-npc-name');
  if (nameEl) nameEl.textContent = npc.name;

  const cityEl = document.getElementById('delete-captcha-npc-city');
  if (cityEl) cityEl.textContent = `📍 ${npc.city || 'Sin ciudad asignada'}`;

  // Resetear campo de entrada y mensaje de error
  const input = document.getElementById('delete-captcha-input');
  if (input) {
    input.value = '';
    input.classList.remove('shake');
  }

  const errorEl = document.getElementById('delete-captcha-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  openModal('modal-delete-captcha');
  drawCaptcha(currentCaptchaCode);

  setTimeout(() => {
    if (input) input.focus();
  }, 150);
}

function confirmDeleteNpc(id) {
  openDeleteCaptchaModal(id);
}

async function handleConfirmDeleteWithCaptcha() {
  if (!deleteTargetNpcId) return;

  const input = document.getElementById('delete-captcha-input');
  const errorEl = document.getElementById('delete-captcha-error');
  const val = (input?.value || '').trim().toUpperCase();

  if (!val) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Ingresa el código mostrado en la imagen.';
      errorEl.style.display = 'block';
    }
    if (input) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      input.focus();
    }
    return;
  }

  if (val !== currentCaptchaCode.toUpperCase()) {
    if (errorEl) {
      errorEl.textContent = '❌ Código incorrecto. Se ha generado un nuevo código.';
      errorEl.style.display = 'block';
    }
    if (input) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      input.value = '';
    }
    // Regenerar código para mayor seguridad
    currentCaptchaCode = generateCaptchaCode(5);
    drawCaptcha(currentCaptchaCode);
    if (input) input.focus();
    return;
  }

  // Captcha correcto: proceder con la eliminación segura
  const targetId = deleteTargetNpcId;
  const npc = AppState.npcs.find(n => n.id === targetId);
  const npcName = npc ? npc.name : 'NPC';

  AppState.npcs = AppState.npcs.filter(n => n.id !== targetId);
  if (AppState.selectedNpcId === targetId) {
    AppState.selectedNpcId = AppState.npcs.length > 0 ? AppState.npcs[0].id : null;
  }

  deleteTargetNpcId = null;
  closeModal('modal-delete-captcha');
  await saveToStorage();
  renderApp();
  showToast(`NPC "${npcName}" eliminado permanentemente`, 'success');
}

// ==========================================
// MODAL DE MAPA INTERACTIVO
// ==========================================
function openMapModal(npc, overrideCoords = null, overrideCityName = null) {
  let coordX = npc.coordinates?.x;
  let coordY = npc.coordinates?.y;
  let coordZ = npc.coordinates?.z || '7';
  let cityName = npc.city || 'Tibia';

  if (overrideCoords) {
    coordX = overrideCoords.x;
    coordY = overrideCoords.y;
    coordZ = overrideCoords.z || '7';
    cityName = overrideCityName || cityName;
  } else if (isRashidNpc(npc)) {
    const rInfo = getRashidActiveSchedule(AppState.rashidSelectedDay);
    coordX = rInfo.schedule.coords.x;
    coordY = rInfo.schedule.coords.y;
    coordZ = rInfo.schedule.coords.z;
    cityName = `${rInfo.schedule.city} (${rInfo.schedule.dayName})`;
  } else if (isYasirNpc(npc)) {
    const yInfo = getCachedYasirInfo();
    coordX = yInfo.port.coordinates.x;
    coordY = yInfo.port.coordinates.y;
    coordZ = yInfo.port.coordinates.z;
    cityName = `${yInfo.port.name}`;
  }

  if (!coordX || !coordY) {
    showToast('Este NPC no tiene coordenadas configuradas', 'error');
    return;
  }

  const mapTitle = document.getElementById('map-modal-title');
  const mapIframe = document.getElementById('map-iframe');
  const coordsLabel = document.getElementById('map-modal-coords-label');
  const externalLink = document.getElementById('map-external-link');
  const btnRecenter = document.getElementById('btn-recenter-map');

  const mapUrl = `https://tibiamaps.io/map#${coordX},${coordY},${coordZ}:2`;

  mapTitle.textContent = `📍 Ubicación de ${npc.name} (${cityName})`;
  coordsLabel.textContent = `Coordenadas: X: ${coordX} | Y: ${coordY} | Piso: ${coordZ}`;
  externalLink.href = mapUrl;

  openModal('modal-map');
  mapIframe.src = mapUrl;

  if (btnRecenter) {
    btnRecenter.onclick = () => {
      mapIframe.src = '';
      setTimeout(() => {
        mapIframe.src = mapUrl;
      }, 50);
    };
  }
}

// ==========================================
// GESTIÓN DE DATOS / BACKUP / DEMO
// ==========================================
function exportDatabaseToJson() {
  if (AppState.npcs.length === 0) {
    showToast('No hay datos para exportar', 'error');
    return;
  }

  const jsonStr = JSON.stringify(AppState.npcs, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tibia_npcs_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Base de datos exportada en formato JSON', 'success');
}

function importDatabaseFromJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (!Array.isArray(imported)) {
        throw new Error('El archivo no contiene una lista válida de NPCs');
      }

      const replace = confirm(
        `Se leyeron ${imported.length} NPCs del archivo.\n` +
        `Presiona Aceptar para REEMPLAZAR tu lista actual, o Cancelar para COMBINAR con los existentes.`
      );

      if (replace) {
        AppState.npcs = imported;
      } else {
        // Combinar evitando IDs duplicados
        const existingIds = new Set(AppState.npcs.map(n => n.id));
        imported.forEach(item => {
          if (!existingIds.has(item.id)) {
            AppState.npcs.push(item);
          }
        });
      }

      if (AppState.npcs.length > 0) {
        AppState.selectedNpcId = AppState.npcs[0].id;
      }

      saveToStorage();
      closeModal('modal-backup');
      renderApp();
      showToast('Datos importados correctamente', 'success');
    } catch (err) {
      showToast(`Error al importar JSON: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset input
}

// ==========================================
// VACIAR BASE DE DATOS CON CAPTCHA
// ==========================================
let currentClearDbCaptchaCode = '';

function openClearDatabaseCaptchaModal() {
  if (AppState.npcs.length === 0) {
    showToast('La base de datos ya está vacía', 'error');
    return;
  }

  // Cerrar modal de respaldo para evitar superposiciones
  closeModal('modal-backup');

  currentClearDbCaptchaCode = generateCaptchaCode(5);

  const countEl = document.getElementById('clear-db-total-count');
  if (countEl) countEl.textContent = AppState.npcs.length;

  const input = document.getElementById('clear-db-captcha-input');
  if (input) {
    input.value = '';
    input.classList.remove('shake');
  }

  const errorEl = document.getElementById('clear-db-captcha-error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  openModal('modal-clear-db-captcha');
  drawCaptcha(currentClearDbCaptchaCode, 'clear-db-captcha-canvas');

  setTimeout(() => {
    if (input) input.focus();
  }, 150);
}

function clearEntireDatabase() {
  openClearDatabaseCaptchaModal();
}

async function handleConfirmClearDbWithCaptcha() {
  const input = document.getElementById('clear-db-captcha-input');
  const errorEl = document.getElementById('clear-db-captcha-error');
  const val = (input?.value || '').trim().toUpperCase();

  if (!val) {
    if (errorEl) {
      errorEl.textContent = '⚠️ Ingresa el código mostrado en la imagen.';
      errorEl.style.display = 'block';
    }
    if (input) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      input.focus();
    }
    return;
  }

  if (val !== currentClearDbCaptchaCode.toUpperCase()) {
    if (errorEl) {
      errorEl.textContent = '❌ Código incorrecto. Se ha generado un nuevo código.';
      errorEl.style.display = 'block';
    }
    if (input) {
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      input.value = '';
    }
    currentClearDbCaptchaCode = generateCaptchaCode(5);
    drawCaptcha(currentClearDbCaptchaCode, 'clear-db-captcha-canvas');
    if (input) input.focus();
    return;
  }

  // Captcha correcto -> Vaciar base de datos completamente
  AppState.npcs = [];
  AppState.selectedNpcId = null;
  closeModal('modal-clear-db-captcha');
  await saveToStorage();
  renderApp();
  showToast('Base de datos vaciada por completo', 'success');
}

// Cargar datos de prueba de ejemplo (Opcional por si el usuario quiere probar el sistema)
function loadSampleDemoData() {
  if (AppState.npcs.length > 0) {
    if (!confirm('¿Deseas cargar los datos de demostración? Se añadirán NPCs como Frodo y Rashid.')) {
      return;
    }
  }

  const sampleNpcs = [
    {
      id: 'npc_frodo_sample',
      name: 'Frodo',
      city: 'Thais',
      location: 'En la taberna de Frodo al sur del templo',
      job: 'Tabernero y Comerciante de Comida',
      race: 'Humano',
      imageUrl: 'https://static.wikia.nocookie.net/tibia/images/a/a2/Frodo.gif',
      coordinates: { x: '32369', y: '32241', z: '7' },
      mapUrl: 'https://tibiamaps.io/map#32369,32241,7:2',
      itemsSells: [
        { name: 'Brown Bread', price: 3, currency: 'gp', notes: 'Alimento básico' },
        { name: 'Cheese', price: 5, currency: 'gp', notes: '' },
        { name: 'Ham', price: 8, currency: 'gp', notes: 'Restaura bastante maná' },
        { name: 'Meat', price: 5, currency: 'gp', notes: '' },
        { name: 'Mug of Beer', price: 2, currency: 'gp', notes: 'Bebida alcohólica' },
        { name: 'Mug of Wine', price: 3, currency: 'gp', notes: '' }
      ],
      itemsBuys: [
        { name: 'Empty Vial', price: 5, currency: 'gp', notes: 'Frasco de poción vacío' },
        { name: 'Empty Mug', price: 1, currency: 'gp', notes: '' }
      ],
      sourceUrl: 'https://tibia.fandom.com/wiki/Frodo',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'npc_rashid_sample',
      name: 'Rashid',
      city: 'Svargrond, Liberty Bay, Port Hope, Ankrahmun, Darashia, Edron, Carlin',
      location: 'Viajero semanal: cambia de ciudad cada día tras el Server Save (10:00 CET).',
      job: 'Comerciante Viajero de Equipo de Alto Nivel',
      race: 'Humano',
      imageUrl: 'https://static.wikia.nocookie.net/tibia/images/7/77/Rashid.gif',
      coordinates: { x: '32684', y: '31713', z: '7' },
      mapUrl: 'https://tibiamaps.io/map#32684,31713,7:2',
      itemsSells: [],
      itemsBuys: [
        { name: 'Dragon Slayer', price: 44000, currency: 'gp', notes: 'Espada de dos manos' },
        { name: 'Demon Shield', price: 30000, currency: 'gp', notes: 'Escudo' },
        { name: 'Golden Armor', price: 20000, currency: 'gp', notes: 'Armadura pesada' },
        { name: 'Boots of Haste', price: 30000, currency: 'gp', notes: 'Aumenta velocidad' },
        { name: 'Crown Armor', price: 12000, currency: 'gp', notes: '' },
        { name: 'Crown Shield', price: 8000, currency: 'gp', notes: '' },
        { name: 'Skull Staff', price: 6000, currency: 'gp', notes: '' },
        { name: 'Fire Axe', price: 8000, currency: 'gp', notes: '' }
      ],
      sourceUrl: 'https://tibia.fandom.com/wiki/Rashid',
      updatedAt: new Date().toISOString()
    }
  ];

  AppState.npcs = sampleNpcs;
  AppState.selectedNpcId = sampleNpcs[0].id;
  saveToStorage();
  closeModal('modal-backup');
  renderApp();
  showToast('Datos de demostración cargados exitosamente', 'success');
}

// ==========================================
// MODAL: TODOS LOS NPCS REGISTRADOS
// ==========================================
let currentPreviewNpcId = null;
let currentPreviewTab = 'sells';
let currentPreviewItemQuery = '';

function openAllNpcsModal() {
  closeModal('modal-backup');
  const viewList = document.getElementById('all-npcs-view-list');
  const viewDetail = document.getElementById('all-npcs-view-detail');
  if (viewList) viewList.style.display = 'block';
  if (viewDetail) viewDetail.style.display = 'none';

  const input = document.getElementById('all-npcs-filter-input');
  if (input) input.value = '';
  renderAllNpcsGrid('');
  openModal('modal-all-npcs');
  setTimeout(() => input?.focus(), 150);
}

function closeNpcQuickPreview() {
  const viewList = document.getElementById('all-npcs-view-list');
  const viewDetail = document.getElementById('all-npcs-view-detail');
  if (viewDetail) viewDetail.style.display = 'none';
  if (viewList) viewList.style.display = 'block';

  const footerInfo = document.getElementById('all-npcs-footer-info');
  if (footerInfo) footerInfo.textContent = '💡 Haz clic en cualquier NPC para inspeccionarlo aquí mismo sin salir.';

  const btnFooterClose = document.getElementById('btn-all-npcs-footer-close');
  if (btnFooterClose) btnFooterClose.textContent = 'Cerrar';

  const filterInput = document.getElementById('all-npcs-filter-input');
  renderAllNpcsGrid(filterInput ? filterInput.value : '');
}

function openNpcQuickPreview(npcId) {
  const npc = (AppState.npcs || []).find(n => n.id === npcId);
  if (!npc) return;

  currentPreviewNpcId = npcId;
  currentPreviewTab = (npc.itemsSells && npc.itemsSells.length > 0) ? 'sells' : 'buys';
  currentPreviewItemQuery = '';

  const viewList = document.getElementById('all-npcs-view-list');
  const viewDetail = document.getElementById('all-npcs-view-detail');
  if (viewList) viewList.style.display = 'none';
  if (viewDetail) viewDetail.style.display = 'block';

  const badge = document.getElementById('all-npcs-preview-badge');
  if (badge) badge.textContent = `🔍 Inspeccionando: ${npc.name}`;

  const footerInfo = document.getElementById('all-npcs-footer-info');
  if (footerInfo) footerInfo.textContent = `💡 Viendo a ${npc.name}. Presiona "Cerrar" o "Volver" para regresar a la lista de NPCs.`;

  const btnFooterClose = document.getElementById('btn-all-npcs-footer-close');
  if (btnFooterClose) btnFooterClose.textContent = '⬅ Volver a la Lista';

  renderPreviewDetailContent(npc);
}

function renderPreviewDetailContent(npc) {
  const container = document.getElementById('all-npcs-preview-content');
  if (!container) return;

  let avatarUrl = npc.imageUrl;
  if (avatarUrl && avatarUrl.includes('NPC_Bubble_')) avatarUrl = '';
  if (!avatarUrl && npc.name && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
    avatarUrl = TibiaScraper.getFandomItemIconUrl(npc.name);
  }
  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" alt="${npc.name}" onerror="handleAvatarImageError(this)">`
    : DEFAULT_AVATAR_SVG;

  let mapUrl = '';
  if (npc.coordinates && npc.coordinates.x && npc.coordinates.y) {
    mapUrl = `https://tibiamaps.io/map#${npc.coordinates.x},${npc.coordinates.y},${npc.coordinates.z || '7'}:2`;
  }

  const wikiUrl = (npc.sourceUrl && npc.sourceUrl.trim()) 
    ? npc.sourceUrl.trim() 
    : `https://tibia.fandom.com/wiki/${encodeURIComponent(npc.name.trim().replace(/\s+/g, '_'))}`;

  const sellsCount = (npc.itemsSells || []).length;
  const buysCount = (npc.itemsBuys || []).length;

  container.innerHTML = `
    <div class="preview-npc-profile-card">
      <div class="preview-npc-top">
        <div class="preview-npc-info">
          <div class="preview-npc-avatar">
            ${avatarHtml}
          </div>
          <div class="preview-npc-title">
            <h3>${npc.name}</h3>
            <div class="preview-npc-meta">
              <span class="meta-tag tag-city">📍 ${npc.city || 'Sin ciudad'}</span>
              <span class="meta-tag tag-job">💼 ${npc.job || 'Comerciante'}</span>
              ${npc.location && npc.location !== npc.city ? `<span class="meta-tag">🗺️ ${npc.location}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${mapUrl ? `
            <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" title="Ver en TibiaMaps.io">
              📍 TibiaMaps ↗
            </a>
          ` : ''}
          <a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Ver página oficial en TibiaWiki">
            🌐 TibiaWiki ↗
          </a>
        </div>
      </div>
    </div>

    <!-- Pestañas de Items del NPC para checarlo -->
    <div class="items-section" style="margin-top: 0.5rem;">
      <div class="tabs-nav" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" id="preview-tab-sells" class="tab-btn ${currentPreviewTab === 'sells' ? 'active' : ''}">
            📦 Lo que Vende <span class="tab-badge">${sellsCount}</span>
          </button>
          <button type="button" id="preview-tab-buys" class="tab-btn ${currentPreviewTab === 'buys' ? 'active' : ''}">
            💰 Lo que Compra <span class="tab-badge">${buysCount}</span>
          </button>
        </div>
        <div style="min-width: 200px; flex: 1; max-width: 320px;">
          <input 
            type="text" 
            id="preview-items-search" 
            class="form-input" 
            placeholder="🔍 Buscar item..." 
            value="${escapeHtml(currentPreviewItemQuery)}" 
            style="padding: 0.35rem 0.65rem; font-size: 0.8rem;"
            autocomplete="off"
          >
        </div>
      </div>

      <div class="preview-table-container">
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 55%;">Item</th>
              <th style="width: 25%;">Precio</th>
              <th style="width: 20%;">Notas</th>
            </tr>
          </thead>
          <tbody id="preview-items-table-body">
            <!-- Items renderizados -->
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners de pestañas e input
  const tabSells = document.getElementById('preview-tab-sells');
  const tabBuys = document.getElementById('preview-tab-buys');
  const searchInput = document.getElementById('preview-items-search');

  if (tabSells) {
    tabSells.addEventListener('click', () => {
      currentPreviewTab = 'sells';
      tabSells.classList.add('active');
      tabBuys?.classList.remove('active');
      renderPreviewItemsRows(npc);
    });
  }

  if (tabBuys) {
    tabBuys.addEventListener('click', () => {
      currentPreviewTab = 'buys';
      tabBuys.classList.add('active');
      tabSells?.classList.remove('active');
      renderPreviewItemsRows(npc);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentPreviewItemQuery = e.target.value.trim().toLowerCase();
      renderPreviewItemsRows(npc);
    });
  }

  renderPreviewItemsRows(npc);
}

function renderPreviewItemsRows(npc) {
  const tbody = document.getElementById('preview-items-table-body');
  if (!tbody) return;

  const raw = currentPreviewTab === 'sells' ? (npc.itemsSells || []) : (npc.itemsBuys || []);
  let items = [...raw];

  if (currentPreviewItemQuery) {
    items = items.filter(i => isItemMatch(i, currentPreviewItemQuery) || matchesPrefixSequence(i.notes, currentPreviewItemQuery));
  }

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-dim); font-size: 0.88rem;">
          ${raw.length === 0 
            ? 'Este NPC no tiene items registrados en esta lista.' 
            : `No hay items que coincidan con "${escapeHtml(currentPreviewItemQuery)}".`}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    let iconUrl = item.icon || '';
    if (!iconUrl || iconUrl.startsWith('data:image')) {
      if (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
        iconUrl = TibiaScraper.getFandomItemIconUrl(item.name);
      }
    }
    const itemThumbHtml = iconUrl 
      ? `<img src="${iconUrl}" alt="${item.name}" referrerpolicy="no-referrer" loading="lazy" onerror="handleItemImageError(this)">`
      : DEFAULT_ITEM_SVG;

    return `
      <tr>
        <td>
          <div class="item-cell">
            <div class="item-thumb">
              ${itemThumbHtml}
            </div>
            <span class="item-name">${item.name}</span>
          </div>
        </td>
        <td>
          <span class="price-tag">
            <span class="coin-icon"></span>
            ${formatNumber(item.price)} ${item.currency || 'gp'}
          </span>
        </td>
        <td style="color: var(--text-dim); font-size: 0.82rem;">
          ${item.notes || '-'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderAllNpcsGrid(filterText = '') {
  const container = document.getElementById('all-npcs-grid-container');
  const countEl = document.getElementById('all-npcs-modal-count');
  if (!container) return;

  const totalNpcs = AppState.npcs || [];
  if (countEl) countEl.textContent = totalNpcs.length;

  const cleanFilter = (filterText || '').trim().toLowerCase();
  const list = cleanFilter 
    ? totalNpcs.filter(n => 
        (n.name && n.name.toLowerCase().includes(cleanFilter)) ||
        (n.city && n.city.toLowerCase().includes(cleanFilter)) ||
        (n.job && n.job.toLowerCase().includes(cleanFilter))
      )
    : totalNpcs;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="all-npc-empty-notice">
        ${totalNpcs.length === 0 
          ? 'No tienes ningún NPC registrado todavía.<br><span style="font-size: 0.8rem; color: var(--gold-light); margin-top: 0.5rem; display: inline-block;">Usa "Agregar Nuevo NPC" en Datos y Respaldo para registrar el primero.</span>' 
          : `No se encontraron NPCs que coincidan con "<strong>${escapeHtml(cleanFilter)}</strong>".`}
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(npc => {
    const isSelected = npc.id === AppState.selectedNpcId;
    let avatarUrl = npc.imageUrl;
    if (avatarUrl && avatarUrl.includes('NPC_Bubble_')) avatarUrl = '';
    if (!avatarUrl && npc.name && typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl) {
      avatarUrl = TibiaScraper.getFandomItemIconUrl(npc.name);
    }
    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" alt="${npc.name}" onerror="handleAvatarImageError(this)">`
      : DEFAULT_AVATAR_SVG;

    const sellsCount = npc.itemsSells ? npc.itemsSells.length : 0;
    const buysCount = npc.itemsBuys ? npc.itemsBuys.length : 0;

    return `
      <div class="all-npc-card ${isSelected ? 'active' : ''}" data-npc-id="${npc.id}" title="Clic para checar a ${npc.name} aquí mismo">
        <div class="all-npc-avatar">
          ${avatarHtml}
        </div>
        <div class="all-npc-details">
          <div class="all-npc-name">${npc.name}</div>
          <div class="all-npc-city">📍 ${npc.city || 'Sin ciudad'}</div>
          <div class="all-npc-counts">
            <span class="count-badge" title="${sellsCount} items para venta">🏷️ ${sellsCount} vende</span>
            <span class="count-badge" title="${buysCount} items para compra">💰 ${buysCount} compra</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.all-npc-card').forEach(card => {
    card.addEventListener('click', () => {
      const npcId = card.getAttribute('data-npc-id');
      openNpcQuickPreview(npcId);
    });
  });
}

function clearMainSearchFilters() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  AppState.searchQuery = '';

  const filterCity = document.getElementById('filter-city');
  if (filterCity) filterCity.value = '';
  AppState.cityFilter = '';

  AppState.searchMode = 'all';
  document.querySelectorAll('.btn-mode-tab').forEach(b => b.classList.remove('active'));
  const btnAll = document.getElementById('btn-mode-all');
  if (btnAll) btnAll.classList.add('active');

  const btnClearSearch = document.getElementById('btn-clear-search');
  if (btnClearSearch) btnClearSearch.style.display = 'none';

  if (typeof window.updateClearCityVisibility === 'function') {
    window.updateClearCityVisibility();
  }

  renderApp();
}

// ==========================================
// UTILIDADES DE INTERFAZ (MODALES & TOASTS)
// ==========================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  if (modalId === 'modal-all-npcs') {
    const viewDetail = document.getElementById('all-npcs-view-detail');
    if (viewDetail && viewDetail.style.display !== 'none') {
      // Si el usuario está inspeccionando un NPC, al presionar cerrar regresa a la lista de NPCs registrados
      closeNpcQuickPreview();
      return;
    }
  }

  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    // Si cerramos modal-all-npcs desde la lista, regresar a Datos y Respaldo
    if (modalId === 'modal-all-npcs') {
      openModal('modal-backup');
    }
    // Si es modal de mapa, limpiar iframe para no seguir reproduciendo
    if (modalId === 'modal-map') {
      const iframe = document.getElementById('map-iframe');
      if (iframe) iframe.src = '';
    }
    if (modalId === 'modal-monster-map') {
      const cleanIframe = document.getElementById('monster-map-clean-iframe');
      if (cleanIframe) cleanIframe.src = '';
    }
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `
    <span>${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, 3500);
}

// ==========================================
// GESTOR DE FONDOS DE PANTALLA (WALLPAPERS)
// ==========================================
const WALLPAPERS_LIST = [
  {
    id: 'aurora-estanque',
    name: 'Aurora Boreal en Alaska',
    desc: 'Reflejos verdes y cielo boreal en la noche ártica de Alaska',
    url: 'wallpapers/wallpaper-aurora-estanque.jpg'
  },
  {
    id: 'picos-nocturnos',
    name: 'Picos Glaciares de Alaska',
    desc: 'Montañas nevadas y picos árticos bajo la aurora en Alaska',
    url: 'wallpapers/wallpaper-picos-nocturnos.jpg'
  },
  {
    id: 'atardecer-rosa',
    name: 'Atardecer Rosa en Alaska',
    desc: 'Cielo magenta y aguas en calma en los paisajes de Alaska',
    url: 'wallpapers/wallpaper-atardecer-rosa.jpg'
  },
  {
    id: 'aurora-purpura',
    name: 'Aurora Violeta & Bosque de Alaska',
    desc: 'Espectáculo celestial púrpura y verde sobre la tundra de Alaska',
    url: 'wallpapers/wallpaper-aurora-purpura.jpg'
  },
  {
    id: 'glaciar-turquesa',
    name: 'Glaciar & Aguas Turquesas de Alaska',
    desc: 'Témpanos de hielo en los fiordos cristalinos de Alaska',
    url: 'wallpapers/wallpaper-glaciar-turquesa.jpg'
  },
  {
    id: 'barco-pesquero',
    name: 'Barco Pesquero en Alaska',
    desc: 'Puerto pesquero invernal y aguas gélidas en las costas de Alaska',
    url: 'wallpapers/wallpaper-barco-pesquero.jpg'
  },
  {
    id: 'atardecer-artico',
    name: 'Atardecer Carmesí & Montañas de Alaska',
    desc: 'Cielo rojizo encendido sobre las aguas heladas y montañas de Alaska',
    url: 'wallpapers/wallpaper-atardecer-artico.jpg'
  },
  {
    id: 'tundra-dorada',
    name: 'Tundra Dorada & Picos Nevados de Alaska',
    desc: 'Valle otoñal en tonos dorados bajo las cumbres nevadas de Alaska',
    url: 'wallpapers/wallpaper-tundra-dorada.jpg'
  },
  {
    id: 'fiordo-glaciar',
    name: 'Fiordo Helado & Glaciar de Alaska',
    desc: 'Aguas turquesas con témpanos de hielo flotante frente al glaciar ártico',
    url: 'wallpapers/wallpaper-fiordo-glaciar.jpg'
  }
];

function initWallpaperManager() {
  let savedId = localStorage.getItem('tibia_tracker_wallpaper') || 'aurora-estanque';
  if (savedId === 'default') savedId = 'barco-pesquero';
  applyWallpaper(savedId, false);
  renderWallpapersGrid();
}

function applyWallpaper(wallpaperId, showToastMsg = true) {
  const targetId = wallpaperId === 'default' ? 'barco-pesquero' : wallpaperId;
  const wp = WALLPAPERS_LIST.find(w => w.id === targetId) || WALLPAPERS_LIST[0];
  
  // Aplicar fondo en el body manteniendo gradiente oscuro para legibilidad
  document.body.style.backgroundImage = `linear-gradient(180deg, rgba(7, 11, 18, 0.72) 0%, rgba(9, 14, 23, 0.85) 100%), url('${wp.url}')`;
  localStorage.setItem('tibia_tracker_wallpaper', wp.id);

  // Actualizar estado activo en la interfaz
  const container = document.getElementById('wallpapers-grid');
  if (container) {
    container.querySelectorAll('.wallpaper-card').forEach(card => {
      const cardId = card.getAttribute('data-wp-id');
      const thumbWrap = card.querySelector('.wallpaper-thumb-wrap');
      if (cardId === wp.id) {
        card.classList.add('active');
        if (thumbWrap && !thumbWrap.querySelector('.wallpaper-badge-active')) {
          const badge = document.createElement('div');
          badge.className = 'wallpaper-badge-active';
          badge.textContent = '✓ Activo';
          thumbWrap.appendChild(badge);
        }
      } else {
        card.classList.remove('active');
        if (thumbWrap) {
          const badge = thumbWrap.querySelector('.wallpaper-badge-active');
          if (badge) badge.remove();
        }
      }
    });
  }

  if (showToastMsg) {
    showToast(`Fondo cambiado: ${wp.name}`, 'success');
  }
}

function renderWallpapersGrid() {
  const container = document.getElementById('wallpapers-grid');
  if (!container) return;

  const currentId = localStorage.getItem('tibia_tracker_wallpaper') || 'aurora-estanque';
  container.innerHTML = '';

  WALLPAPERS_LIST.forEach(wp => {
    const isActive = wp.id === currentId;
    const card = document.createElement('div');
    card.className = `wallpaper-card ${isActive ? 'active' : ''}`;
    card.setAttribute('data-wp-id', wp.id);
    card.title = `Clic para seleccionar ${wp.name}`;

    card.innerHTML = `
      <div class="wallpaper-thumb-wrap">
        <img class="wallpaper-thumb" src="${wp.url}" alt="${wp.name}" loading="lazy">
        ${isActive ? '<div class="wallpaper-badge-active">✓ Activo</div>' : ''}
      </div>
      <div class="wallpaper-info">
        <div class="wallpaper-title">${wp.name}</div>
        <div class="wallpaper-desc">${wp.desc}</div>
      </div>
    `;

    card.addEventListener('click', () => {
      applyWallpaper(wp.id, true);
    });

    container.appendChild(card);
  });
}

// ==========================================
// CONTROLADOR DEL ACTUALIZADOR EN LA APP
// ==========================================
function initInAppUpdaterUI() {
  const modal = document.getElementById('modal-app-updater');
  const btnHeaderCheck = document.getElementById('btn-check-updates');
  const btnBadge = document.getElementById('btn-updater-badge');
  const badgeLabel = document.getElementById('updater-badge-label');
  const badgePct = document.getElementById('updater-badge-pct');
  const badgeMiniTrack = document.getElementById('updater-badge-mini-track');
  const badgeMiniFill = document.getElementById('updater-badge-mini-fill');
  const tagVer = document.getElementById('updater-version-tag');
  
  const stateIdle = document.getElementById('updater-state-idle');
  const stateDownloading = document.getElementById('updater-state-downloading');
  const stateReady = document.getElementById('updater-state-ready');
  const stateError = document.getElementById('updater-state-error');
  
  const idleTitle = document.getElementById('updater-idle-title');
  const idleDesc = document.getElementById('updater-idle-desc');
  const btnManualCheck = document.getElementById('btn-manual-check-now');
  
  const progressBar = document.getElementById('updater-progress-bar');
  const progressPercent = document.getElementById('updater-progress-percent');
  const btnApply = document.getElementById('btn-apply-update-now');

  let currentStatus = 'idle'; // 'idle' | 'downloading' | 'ready' | 'error'
  let latestDetectedVer = '';
  let userRequestedCheck = false;

  function switchState(state) {
    currentStatus = state;
    if (stateIdle) stateIdle.style.display = state === 'idle' ? 'block' : 'none';
    if (stateDownloading) stateDownloading.style.display = state === 'downloading' ? 'block' : 'none';
    if (stateReady) stateReady.style.display = state === 'ready' ? 'block' : 'none';
    if (stateError) stateError.style.display = state === 'error' ? 'block' : 'none';
    if (btnApply) btnApply.style.display = state === 'ready' ? 'inline-flex' : 'none';
  }

  async function triggerManualCheck() {
    userRequestedCheck = true;
    if (btnHeaderCheck) {
      btnHeaderCheck.disabled = true;
      btnHeaderCheck.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        Comprobando...
      `;
    }
    if (idleDesc) idleDesc.textContent = 'Conectando con GitHub para buscar nuevas versiones...';
    showToast('🏔️ Comprobando si hay actualizaciones disponibles...', 'info');

    if (window.desktopAPI && window.desktopAPI.checkForUpdates) {
      try {
        const res = await window.desktopAPI.checkForUpdates();
        if (res && res.dev) {
          if (idleTitle) idleTitle.textContent = 'Modo Desarrollo';
          if (idleDesc) idleDesc.textContent = 'Las actualizaciones automáticas en vivo se ejecutan en la aplicación instalada.';
          showToast('ℹ️ Modo desarrollo: actualizador listo para la versión instalada.', 'info');
        } else if (res && res.error) {
          throw new Error(res.error);
        }
      } catch (e) {
        console.error('Error comprobando actualizaciones:', e);
        if (idleDesc) idleDesc.textContent = 'No se pudo conectar con el servidor de actualizaciones.';
        const detailsEl = document.getElementById('updater-error-details');
        if (detailsEl) detailsEl.textContent = e.message || 'Error de conexión con GitHub.';
        switchState('error');
        showToast('⚠️ No se pudo conectar con el servidor de actualizaciones.', 'error');
      } finally {
        setTimeout(() => {
          if (btnHeaderCheck) {
            btnHeaderCheck.disabled = false;
            btnHeaderCheck.innerHTML = `
              <img src="logo-alaska-gold.png" alt="Alaska" class="updater-badge-icon" style="width: 20px;" />
              Comprobar Actualizaciones
            `;
          }
          if (btnManualCheck) {
            btnManualCheck.disabled = false;
            const spinner = btnManualCheck.querySelector('svg');
            if (spinner) spinner.classList.remove('spin-icon');
          }
        }, 1400);
      }
    }
  }

  // Clic en botón "Comprobar Actualizaciones" (dentro de Datos & Respaldo)
  if (btnHeaderCheck) {
    btnHeaderCheck.addEventListener('click', () => {
      closeModal('modal-backup');
      triggerManualCheck();
    });
  }

  // Clic en botón manual check dentro del modal
  if (btnManualCheck) {
    btnManualCheck.addEventListener('click', () => {
      triggerManualCheck();
    });
  }

  // Clic en el badge arriba a la derecha:
  // Actualiza directamente SIN NINGUNA VENTANA EMERGENTE EN LA CARA
  if (btnBadge) {
    btnBadge.addEventListener('click', async () => {
      if (currentStatus === 'ready') {
        btnBadge.disabled = true;
        if (badgeLabel) badgeLabel.textContent = 'Instalando actualización...';
        if (badgePct) badgePct.textContent = '⏳';
        showToast('🚀 Reiniciando para aplicar la actualización...', 'info');
        if (window.desktopAPI && window.desktopAPI.applyUpdateNow) {
          await window.desktopAPI.applyUpdateNow();
        }
      } else if (currentStatus === 'downloading') {
        const pct = badgePct ? badgePct.textContent : '0%';
        showToast(`⏳ Descarga en curso (${pct}). Podrás hacer clic en este botón en cuanto termine al 100%.`, 'info');
      } else if (currentStatus === 'error') {
        openModal('modal-app-updater');
      } else {
        triggerManualCheck();
      }
    });
  }

  // Botón para aplicar y reiniciar dentro del modal (si existiera)
  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      btnApply.disabled = true;
      btnApply.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        Reiniciando y aplicando actualización...
      `;
      if (window.desktopAPI && window.desktopAPI.applyUpdateNow) {
        await window.desktopAPI.applyUpdateNow();
      }
    });
  }

  // Botón para copiar reporte de error del actualizador
  const btnCopyAppError = document.getElementById('btn-copy-app-updater-error');
  if (btnCopyAppError) {
    btnCopyAppError.addEventListener('click', async () => {
      const detailsEl = document.getElementById('updater-error-details');
      const errText = detailsEl ? detailsEl.textContent.trim() : 'Error desconocido';
      const textToCopy = [
        '======================================================================',
        'REPORTE DE ERROR - ACTUALIZADOR DE ALASKA TIBIA TRACKER',
        `Fecha: ${new Date().toLocaleString()}`,
        `Versión actual instalada: ${tagVer ? tagVer.textContent : 'v1.0.X'}`,
        '----------------------------------------------------------------------',
        'Detalle técnico del error:',
        errText,
        '======================================================================'
      ].join('\r\n');
      const ok = await copyTextToClipboard(textToCopy);
      if (ok) {
        showToast('📋 Reporte de error copiado al portapapeles', 'success');
        btnCopyAppError.textContent = '✓ Copiado';
        setTimeout(() => { btnCopyAppError.textContent = '📋 Copiar Reporte'; }, 2000);
      }
    });
  }

  // Botón para reintentar comprobación tras error
  const btnRetryAppUpdater = document.getElementById('btn-retry-app-updater');
  if (btnRetryAppUpdater) {
    btnRetryAppUpdater.addEventListener('click', () => {
      switchState('idle');
      triggerManualCheck();
    });
  }

  // Escuchar eventos en vivo emitidos periódicamente en segundo plano
  if (window.desktopAPI && window.desktopAPI.onUpdaterEvent) {
    window.desktopAPI.onUpdaterEvent((data) => {
      if (!data) return;

      if (data.event === 'checking') {
        if (idleDesc && currentStatus === 'idle') {
          idleDesc.textContent = 'Comprobando si hay nuevas versiones en GitHub...';
        }
      }

      if (data.event === 'not-available') {
        const ver = data.version || 'actual';
        if (idleTitle) idleTitle.textContent = '¡Tu juego está al día!';
        if (idleDesc) idleDesc.textContent = `Tienes instalada la versión v${ver}. No hay actualizaciones pendientes por ahora.`;
        // Solo mostrar notificación flotante si el usuario hizo clic explícito en "Comprobar Actualizaciones"
        if (userRequestedCheck) {
          showToast(`✅ Ya tienes la versión más reciente (v${ver}).`, 'success');
          userRequestedCheck = false;
        }
      }

      // NUEVA ACTUALIZACIÓN DISPONIBLE (aparece arriba a la derecha con porcentaje, SIN saltar en la cara)
      if (data.event === 'available') {
        userRequestedCheck = false;
        latestDetectedVer = data.version || '';
        if (tagVer) tagVer.textContent = `v${latestDetectedVer}`;
        if (badgeLabel) badgeLabel.textContent = `Descargando v${latestDetectedVer}...`;
        if (badgePct) {
          badgePct.textContent = '0%';
          badgePct.style.display = 'inline-block';
        }
        if (badgeMiniTrack) badgeMiniTrack.style.display = 'block';
        if (badgeMiniFill) badgeMiniFill.style.width = '0%';
        if (btnBadge) btnBadge.style.display = 'inline-flex';
        switchState('downloading');
        showToast(`🏔️ Descargando actualización v${latestDetectedVer} en segundo plano...`, 'info');
      }

      // PROGRESO EN VIVO (actualiza el porcentaje arriba a la derecha en tiempo real)
      if (data.event === 'progress') {
        switchState('downloading');
        const pct = data.percent || 0;
        if (badgePct) {
          badgePct.textContent = `${pct}%`;
          badgePct.style.display = 'inline-block';
        }
        if (badgeMiniFill) badgeMiniFill.style.width = `${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.textContent = `${pct}%`;
      }

      // DESCARGA COMPLETADA (aviso arriba a la derecha listo para aplicar cuando el usuario quiera)
      if (data.event === 'downloaded') {
        const ver = data.version || latestDetectedVer;
        if (tagVer) tagVer.textContent = `v${ver}`;
        if (badgeLabel) badgeLabel.textContent = `¡v${ver} Lista para Actualizar!`;
        if (badgePct) {
          badgePct.textContent = '100%';
          badgePct.style.background = '#22c55e';
          badgePct.style.borderColor = '#22c55e';
        }
        if (badgeMiniFill) {
          badgeMiniFill.style.width = '100%';
          badgeMiniFill.style.background = '#22c55e';
        }
        if (btnBadge) btnBadge.style.display = 'inline-flex';
        switchState('ready');
        showToast(`🏔️ ¡Actualización v${ver} lista! Haz clic arriba a la derecha para reiniciar cuando quieras.`, 'success');
      }

      if (data.event === 'error') {
        console.warn('Evento error de actualización:', data.message);
        const errorMsg = data.message || 'Error al conectar con el servidor de actualizaciones.';
        const detailsEl = document.getElementById('updater-error-details');
        if (detailsEl) detailsEl.textContent = errorMsg;
        switchState('error');
        if (badgeLabel) badgeLabel.textContent = '⚠️ Error al actualizar';
        showToast(`⚠️ Error en la actualización del sistema: ${errorMsg}`, 'error', 6000);
      }
    });
  }
}

// ==========================================
// INFORME DE CAMBIOS Y NOVEDADES (CHANGELOG)
// ==========================================
const APP_CHANGELOG = [
  {
    version: '1.1.9',
    date: '22 de Octubre, 2026',
    isLatest: true,
    changes: [
      { type: '✨', text: '<strong>Barra superior compacta:</strong> Encabezado optimizado en una sola fila continua para ahorrar espacio en pantalla.' },
      { type: '🚢', text: '<strong>Optimización de Yasir:</strong> Eliminado widget de estado en vivo; Yasir ahora está 100% activo en sus 3 puertos oficiales con accesos a mapa interactivo.' },
      { type: '👾', text: '<strong>Bestiario depurado:</strong> Interfaz más limpia sin campos redundantes y sprites ampliados para mejor visibilidad.' }
    ]
  },
  {
    version: '1.1.8',
    date: '18 de Octubre, 2026',
    isLatest: false,
    changes: [
      { type: '✨', text: '<strong>Imbuing Shrine:</strong> Nueva sección dedicada con los 24 encantamientos oficiales de Tibia (Ataque, Protección, Soporte y Skills), sus creature products requeridos (Basic, Intricate y Powerful) y porcentajes de conversión/bonificación.' },
      { type: '🔗', text: '<strong>Sinergia con Rastreador de NPCs:</strong> Haz clic en cualquier creature product para ver de inmediato qué NPC de tu lista lo compra o vende en Tibia.' },
      { type: '🔍', text: '<strong>Buscador y Filtros en Tiempo Real:</strong> Búsqueda reactiva por nombre, nivel o creature products para encontrar al instante los requerimientos exactos.' }
    ]
  },
  {
    version: '1.1.7',
    date: '14 de Octubre, 2026',
    isLatest: false,
    changes: [
      { type: '🚀', text: '<strong>Descarga fluida garantizada:</strong> Solución definitiva al problema de descarga congelada en 0%. Ahora el instalador se descarga directamente desde el servidor sin interrupciones.' },
      { type: '🛡️', text: '<strong>Notificaciones silenciosas:</strong> Se eliminó el aviso recurrente de "versión más reciente" cada minuto. Ahora solo te avisará si tú solicitas comprobarlo o si hay una actualización disponible.' },
      { type: '📋', text: '<strong>Informe de Actualizaciones:</strong> Nuevo panel completo para consultar el informe de novedades y cambios realizados en cada versión.' },
      { type: '🔝', text: '<strong>Acceso prioritario:</strong> La opción "Comprobar Actualizaciones" ahora está ubicada hasta arriba en el menú de Datos & Respaldo.' }
    ]
  },
  {
    version: '1.1.6',
    date: '14 de Octubre, 2026',
    isLatest: false,
    changes: [
      { type: '🔝', text: '<strong>Reorganización de menú:</strong> Actualizaciones movidas a la cabecera de Datos & Respaldo.' },
      { type: '📊', text: '<strong>Indicador visual:</strong> Porcentaje numérico y barra de progreso mini en tiempo real en la barra superior.' }
    ]
  },
  {
    version: '1.1.5',
    date: '14 de Octubre, 2026',
    isLatest: false,
    changes: [
      { type: '🚫', text: '<strong>Cero modales en la cara:</strong> Eliminación de ventanas emergentes invasivas que interrumpían el uso del programa.' },
      { type: '🔄', text: '<strong>Instalación automática y limpia:</strong> Al pulsar el botón de actualizar, el juego se reinicia e instala en 2 segundos sin trabas.' }
    ]
  },
  {
    version: '1.1.4',
    date: '14 de Octubre, 2026',
    isLatest: false,
    changes: [
      { type: '🎨', text: '<strong>Botón superior con tema Alaska:</strong> Botón dorado en la cabecera para actualizar a voluntad cuando tú lo decidas.' }
    ]
  },
  {
    version: '1.1.0 - 1.1.3',
    date: '13-14 de Octubre, 2026',
    isLatest: false,
    changes: [
      { type: '🏔️', text: '<strong>Fondos de pantalla de Alaska:</strong> Galería de paisajes nórdicos y auroras boreales seleccionables.' },
      { type: '🔒', text: '<strong>Seguridad Captcha:</strong> Protección contra vaciado o eliminación accidental de NPCs.' },
      { type: '🧭', text: '<strong>Detector de Yasir:</strong> Estado en tiempo real del barco viajero en Solidera.' },
      { type: '⚡', text: '<strong>Sincronizador TibiaWiki:</strong> Actualizador masivo de precios e items para todos los NPCs.' }
    ]
  }
];

function initChangelogUI() {
  const btnOpen = document.getElementById('btn-open-changelog');
  const container = document.getElementById('changelog-entries-container');

  if (container) {
    let html = '';
    APP_CHANGELOG.forEach(entry => {
      html += `
        <div class="changelog-card ${entry.isLatest ? 'current-version' : ''}">
          <div class="changelog-header-row">
            <div class="changelog-version-tag">
              <span>Versión v${entry.version}</span>
              ${entry.isLatest ? '<span class="changelog-badge-latest">ACTUAL</span>' : ''}
            </div>
            <div class="changelog-date">${entry.date}</div>
          </div>
          <ul class="changelog-items-list">
            ${entry.changes.map(c => `
              <li class="changelog-item">
                <span class="changelog-item-bullet">${c.type}</span>
                <span>${c.text}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      closeModal('modal-backup');
      openModal('modal-changelog');
    });
  }
}

// ==========================================================================
// MÓDULO DE IMBUEMENTS & CALCULADORA ASTRAL (TIBIA WIKI)
// ==========================================================================

// Cargar datos de Imbuements
async function loadImbuementsFromStorage() {
  let loaded = false;

  // 1. Objeto global pre-cargado desde imbuements_data.js
  if (window.TIBIA_IMBUEMENTS_DATA && Array.isArray(window.TIBIA_IMBUEMENTS_DATA) && window.TIBIA_IMBUEMENTS_DATA.length > 0) {
    AppState.imbuements = window.TIBIA_IMBUEMENTS_DATA;
    loaded = true;
  }

  // 2. Entorno Electron
  if (!loaded && window.desktopAPI && window.desktopAPI.loadImbuements) {
    try {
      const resp = await window.desktopAPI.loadImbuements();
      if (Array.isArray(resp) && resp.length > 0) {
        AppState.imbuements = resp;
        loaded = true;
      }
    } catch (e) {
      console.warn('Error cargando imbuements desde desktopAPI:', e);
    }
  }

  // 3. Entorno Web API o fetch estático
  if (!loaded) {
    try {
      const res = await fetch('/api/get-imbuements');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          AppState.imbuements = data;
          loaded = true;
        }
      }
    } catch (e) {
      try {
        const resStatic = await fetch('/imbuements_data.json');
        if (resStatic.ok) {
          const dataStatic = await resStatic.json();
          if (Array.isArray(dataStatic) && dataStatic.length > 0) {
            AppState.imbuements = dataStatic;
            loaded = true;
          }
        }
      } catch (err) {}
    }
  }

  // Cargar datos de Drops de Monstruos si aún no están en memoria
  if (!AppState.creatureDrops || Object.keys(AppState.creatureDrops).length === 0) {
    if (typeof CREATURE_DROPS_DATA !== 'undefined' && Object.keys(CREATURE_DROPS_DATA).length > 0) {
      AppState.creatureDrops = CREATURE_DROPS_DATA;
    } else {
      try {
        if (window.desktopAPI && window.desktopAPI.loadCreatureDrops) {
          const d = await window.desktopAPI.loadCreatureDrops();
          if (d && Object.keys(d).length > 0) AppState.creatureDrops = d;
        } else {
          const resStatic = await fetch('/creature_drops_data.json');
          if (resStatic.ok) {
            const d = await resStatic.json();
            if (d && Object.keys(d).length > 0) AppState.creatureDrops = d;
          }
        }
      } catch (err) {}
    }
  }

  // Cargar Sprites de Monstruos si aún no están en memoria
  if (!AppState.monsterSprites || Object.keys(AppState.monsterSprites).length === 0) {
    if (typeof MONSTER_SPRITES_DATA !== 'undefined' && Object.keys(MONSTER_SPRITES_DATA).length > 0) {
      AppState.monsterSprites = MONSTER_SPRITES_DATA;
    } else {
      try {
        if (window.desktopAPI && window.desktopAPI.loadMonsterSprites) {
          const s = await window.desktopAPI.loadMonsterSprites();
          if (s && Object.keys(s).length > 0) AppState.monsterSprites = s;
        } else {
          const resStatic = await fetch('/monster_sprites.json');
          if (resStatic.ok) {
            const s = await resStatic.json();
            if (s && Object.keys(s).length > 0) AppState.monsterSprites = s;
          }
        }
      } catch (err) {}
    }
  }

  // Renderizar vistas
  renderImbuements();
  updateNavBadges();
}

// Actualizar badges de conteo en la barra de navegación superior
function updateNavBadges() {
  const badgeNpcs = document.getElementById('nav-badge-npcs-count');
  if (badgeNpcs) {
    badgeNpcs.textContent = AppState.npcs ? AppState.npcs.length : 0;
  }

  const badgeMonsters = document.getElementById('nav-badge-monsters-count');
  if (badgeMonsters) {
    const totalMonsters = AppState.monsters ? Object.keys(AppState.monsters).length : 260;
    badgeMonsters.textContent = totalMonsters;
  }

  const allCount = AppState.imbuements ? AppState.imbuements.length : 24;
  const basicCount = AppState.imbuements ? AppState.imbuements.filter(i => i.category === 'Basic Imbuements (Gold Token)').length : 3;
  const attackCount = AppState.imbuements ? AppState.imbuements.filter(i => i.category === 'Attack Imbuements').length : 5;
  const protectCount = AppState.imbuements ? AppState.imbuements.filter(i => i.category === 'Protective Imbuements').length : 6;
  const supportCount = AppState.imbuements ? AppState.imbuements.filter(i => i.category === 'Support Imbuements').length : 3;
  const skillsCount = AppState.imbuements ? AppState.imbuements.filter(i => i.category === 'Skill Improving Imbuements').length : 7;

  const elAll = document.getElementById('imbu-count-all');
  if (elAll) elAll.textContent = allCount;
  const elBasic = document.getElementById('imbu-count-basic');
  if (elBasic) elBasic.textContent = basicCount;
  const elAtt = document.getElementById('imbu-count-attack');
  if (elAtt) elAtt.textContent = attackCount;
  const elPro = document.getElementById('imbu-count-protect');
  if (elPro) elPro.textContent = protectCount;
  const elSup = document.getElementById('imbu-count-support');
  if (elSup) elSup.textContent = supportCount;
  const elSki = document.getElementById('imbu-count-skills');
  if (elSki) elSki.textContent = skillsCount;
}

// Cambiar de vista principal ('npcs' | 'imbuements' | 'monsters')
function switchAppView(viewName) {
  AppState.currentView = viewName;
  const viewNpcs = document.getElementById('view-npcs');
  const viewImbu = document.getElementById('view-imbuements');
  const viewMonsters = document.getElementById('view-monsters');
  const tabNpcs = document.getElementById('tab-btn-npcs');
  const tabImbu = document.getElementById('tab-btn-imbuements');
  const tabMonsters = document.getElementById('tab-btn-monsters');

  // Ocultar todas las vistas y remover clases activas de tabs
  if (viewNpcs) viewNpcs.style.display = 'none';
  if (viewImbu) viewImbu.style.display = 'none';
  if (viewMonsters) viewMonsters.style.display = 'none';

  if (tabNpcs) tabNpcs.classList.remove('active');
  if (tabImbu) tabImbu.classList.remove('active');
  if (tabMonsters) tabMonsters.classList.remove('active');

  if (viewName === 'npcs') {
    if (viewNpcs) viewNpcs.style.display = 'flex';
    if (tabNpcs) tabNpcs.classList.add('active');
  } else if (viewName === 'imbuements') {
    if (viewImbu) viewImbu.style.display = 'flex';
    if (tabImbu) tabImbu.classList.add('active');
    renderImbuements();
  } else if (viewName === 'monsters') {
    if (viewMonsters) viewMonsters.style.display = 'flex';
    if (tabMonsters) tabMonsters.classList.add('active');
    renderMonsters();
  }
}

// Inicializar listeners del módulo de Imbuements
function initImbuementsUI() {
  // Pestañas superiores de navegación principal
  const tabNpcs = document.getElementById('tab-btn-npcs');
  const tabImbu = document.getElementById('tab-btn-imbuements');

  if (tabNpcs) {
    tabNpcs.addEventListener('click', () => switchAppView('npcs'));
  }
  if (tabImbu) {
    tabImbu.addEventListener('click', () => switchAppView('imbuements'));
  }

  // Buscador de Imbuements
  const imbuSearchInput = document.getElementById('imbu-search-input');
  const btnClearImbuSearch = document.getElementById('btn-clear-imbu-search');

  function updateClearImbuVisibility() {
    if (btnClearImbuSearch && imbuSearchInput) {
      btnClearImbuSearch.style.display = imbuSearchInput.value.trim().length > 0 ? 'flex' : 'none';
    }
  }

  if (imbuSearchInput) {
    imbuSearchInput.addEventListener('input', (e) => {
      AppState.imbuFilter.query = e.target.value.toLowerCase().trim();
      updateClearImbuVisibility();
      renderImbuements();
    });
  }

  if (btnClearImbuSearch) {
    btnClearImbuSearch.addEventListener('click', () => {
      if (imbuSearchInput) {
        imbuSearchInput.value = '';
        AppState.imbuFilter.query = '';
        updateClearImbuVisibility();
        imbuSearchInput.focus();
        renderImbuements();
      }
    });
  }

  // Filtros por Categoría
  const catButtons = document.querySelectorAll('.btn-imbu-cat');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const catKey = btn.getAttribute('data-cat') || 'all';
      AppState.imbuFilter.category = catKey;
      if (catKey !== 'all') {
        AppState.minimizedCategories.delete(catKey);
      }
      renderImbuements();
    });
  });

  // Filtro por Nivel (Tier)
  const tierSelect = document.getElementById('imbu-tier-select');
  if (tierSelect) {
    tierSelect.addEventListener('change', (e) => {
      AppState.imbuFilter.tier = e.target.value;
      renderImbuements();
    });
  }

  // Botón Expandir / Colapsar Todo
  const btnToggleAll = document.getElementById('btn-toggle-all-imbu');
  if (btnToggleAll) {
    btnToggleAll.addEventListener('click', toggleAllImbuements);
  }
}

// Configuración de categorías de Imbuements (Básicos con Gold Token primero por orden de importancia)
const IMBU_CATEGORIES_CONFIG = [
  {
    key: 'Basic Imbuements (Gold Token)',
    title: 'Imbuiments Basicos (Gold Token)',
    titleHtml: 'Imbuiments Basicos (Gold Token <img src="gold_token.png" alt="Gold Token" class="imbu-gold-token-inline-icon">)',
    icon: '<img src="basic_imbu_icon.png?v=2" alt="Mana Leech" class="imbu-cat-custom-icon">',
    color: '#ffd753',
    desc: 'Los 3 encantamientos esenciales canjeables por Gold Tokens: Mana Leech (Void), Life Leech (Vampirism) y Critical Hit (Strike).'
  },
  {
    key: 'Protective Imbuements',
    title: 'Imbuements de Protección',
    icon: '<img src="imbu_protect_icon.png" alt="Protección" class="imbu-cat-custom-icon">',
    color: '#38bdf8',
    desc: 'Reducción de daño elemental (Fuego, Hielo, Tierra, Energía, Muerte y Sagrado).'
  },
  {
    key: 'Support Imbuements',
    title: 'Imbuements de Soporte',
    icon: '<img src="imbu_support_icon.png" alt="Soporte" class="imbu-cat-custom-icon">',
    color: '#22c55e',
    desc: 'Velocidad (Swiftness), capacidad (Featherweight) y remoción de parálisis (Paralysis Deflection).'
  },
  {
    key: 'Skill Improving Imbuements',
    title: 'Imbuements de Skills',
    icon: '<img src="imbu_skills_icon.png" alt="Skills" class="imbu-cat-custom-icon">',
    color: '#eab308',
    desc: 'Bonificación de Magic Level, Sword, Axe, Club, Distance, Shielding y Fishing.'
  },
  {
    key: 'Attack Imbuements',
    title: 'Imbuements de Ataque',
    icon: '<img src="imbu_attack_icon.png" alt="Ataque" class="imbu-cat-custom-icon">',
    color: '#f97316',
    desc: 'Conversión de daño elemental (Fuego, Tierra, Hielo, Energía y Muerte).'
  }
];

// Alternar minimizar/expandir de una sección completa de categoría
function toggleCategorySection(categoryKey, event) {
  if (event) {
    event.stopPropagation();
  }
  const sectionId = `imbu-cat-section-${categoryKey.replace(/\s+/g, '_')}`;
  const section = document.getElementById(sectionId);
  if (!section) return;

  const isMinimized = section.classList.contains('minimized');
  if (isMinimized) {
    section.classList.remove('minimized');
    AppState.minimizedCategories.delete(categoryKey);
    const textSpan = section.querySelector('.imbu-cat-min-text');
    if (textSpan) textSpan.textContent = 'Minimizar';
  } else {
    section.classList.add('minimized');
    AppState.minimizedCategories.add(categoryKey);
    const textSpan = section.querySelector('.imbu-cat-min-text');
    if (textSpan) textSpan.textContent = 'Expandir';
  }
  checkAllToggledState();
}
window.toggleCategorySection = toggleCategorySection;

// Alternar visibilidad de detalles de un imbuement individual (Click para desplegar creature products)
function toggleImbuement(imbuId, event) {
  if (event) {
    event.stopPropagation();
  }
  const row = document.getElementById(`imbu-row-${imbuId}`);
  if (!row) return;

  const isExpanded = row.classList.contains('expanded');
  if (isExpanded) {
    row.classList.remove('expanded');
    AppState.expandedImbuements.delete(imbuId);
  } else {
    row.classList.add('expanded');
    AppState.expandedImbuements.add(imbuId);
  }
  checkAllToggledState();
}
window.toggleImbuement = toggleImbuement;

// Abrir enlaces externos (ej. TibiaWiki) en el navegador del sistema si estamos en Electron
function openExternalWikiLink(url, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!url) return;
  if (window.desktopAPI && typeof window.desktopAPI.openExternalUrl === 'function') {
    if (event) event.preventDefault();
    window.desktopAPI.openExternalUrl(url);
  }
}
window.openExternalWikiLink = openExternalWikiLink;

// Expandir o colapsar todas las filas y categorías a la vez
function toggleAllImbuements() {
  const allRows = document.querySelectorAll('.imbu-list-row');
  const allSections = document.querySelectorAll('.imbu-category-section');
  const allImbu = AppState.imbuements || [];
  
  const anyRowClosed = Array.from(allRows).some(r => !r.classList.contains('expanded'));
  const anyCatClosed = Array.from(allSections).some(s => s.classList.contains('minimized'));

  if (anyRowClosed || anyCatClosed) {
    // Abrir todo
    allSections.forEach(s => {
      s.classList.remove('minimized');
      const textSpan = s.querySelector('.imbu-cat-min-text');
      if (textSpan) textSpan.textContent = 'Minimizar';
    });
    AppState.minimizedCategories.clear();

    allRows.forEach(r => r.classList.add('expanded'));
    allImbu.forEach(i => AppState.expandedImbuements.add(i.id));
    updateToggleAllBtn(true);
  } else {
    // Cerrar todo
    allRows.forEach(r => r.classList.remove('expanded'));
    AppState.expandedImbuements.clear();

    allSections.forEach(s => {
      s.classList.add('minimized');
      const textSpan = s.querySelector('.imbu-cat-min-text');
      if (textSpan) textSpan.textContent = 'Expandir';
    });
    IMBU_CATEGORIES_CONFIG.forEach(c => AppState.minimizedCategories.add(c.key));

    updateToggleAllBtn(false);
  }
}
window.toggleAllImbuements = toggleAllImbuements;

function checkAllToggledState() {
  const allRows = document.querySelectorAll('.imbu-list-row');
  const allSections = document.querySelectorAll('.imbu-category-section');
  if (!allRows.length && !allSections.length) return;
  const anyRowClosed = Array.from(allRows).some(r => !r.classList.contains('expanded'));
  const anyCatClosed = Array.from(allSections).some(s => s.classList.contains('minimized'));
  updateToggleAllBtn(!anyRowClosed && !anyCatClosed);
}

function updateToggleAllBtn(isAllExpanded) {
  const icon = document.getElementById('imbu-toggle-all-icon');
  const text = document.getElementById('imbu-toggle-all-text');
  if (icon && text) {
    if (isAllExpanded) {
      icon.textContent = '📁';
      text.textContent = 'Colapsar Todo';
    } else {
      icon.textContent = '📂';
      text.textContent = 'Expandir Todo';
    }
  }
}

// Renderizar la Lista de Imbuements Agrupada por Categorías Minimizable
function renderImbuements() {
  const container = document.getElementById('imbuements-cards-grid');
  if (!container) return;

  const query = (AppState.imbuFilter.query || '').toLowerCase().trim();
  const selectedCat = AppState.imbuFilter.category || 'all';
  const selectedTier = AppState.imbuFilter.tier || 'all';

  const allImbuements = AppState.imbuements || [];

  // Filtrado reactivo de imbuements
  const filtered = allImbuements.filter(imbu => {
    // Categoría
    if (selectedCat !== 'all' && imbu.category !== selectedCat) {
      return false;
    }

    // Texto de búsqueda
    if (query) {
      const matchTitle = imbu.title.toLowerCase().includes(query);
      const matchDesc = (imbu.description || '').toLowerCase().includes(query);
      const matchCat = (imbu.category || '').toLowerCase().includes(query) || (imbu.categoryEs || '').toLowerCase().includes(query);
      const matchTiers = imbu.tiers.some(t => {
        const matchTierName = t.name.toLowerCase().includes(query);
        const matchSlots = (t.availableFor || '').toLowerCase().includes(query);
        const matchSources = t.sources.some(s => s.name.toLowerCase().includes(query));
        return matchTierName || matchSlots || matchSources;
      });

      if (!matchTitle && !matchDesc && !matchCat && !matchTiers) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-card); border: 1px solid var(--border-dim); border-radius: var(--radius-lg); width: 100%;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.75rem;">🔍</span>
        <h3 style="color: var(--gold-light); font-family: var(--font-fantasy); margin-bottom: 0.5rem;">No se encontraron Imbuements</h3>
        <p style="color: var(--text-dim); font-size: 0.9rem; max-width: 480px; margin: 0 auto;">
          No hay encantamientos que coincidan con "<strong>${escapeHtml(query)}</strong>". Intenta con otro término (ej. <em>Vampirism</em>, <em>Fiery Heart</em>, <em>Critical</em> o <em>Bows</em>).
        </p>
      </div>
    `;
    return;
  }

  let fullHtml = '';

  // Renderizar cada categoría en orden estricto (Protección primero)
  IMBU_CATEGORIES_CONFIG.forEach(catConfig => {
    // Si hay un filtro específico por categoría y no es esta, la omitimos
    if (selectedCat !== 'all' && selectedCat !== catConfig.key) {
      return;
    }

    // Imbuements que pertenecen a esta categoría
    const catItems = filtered.filter(item => item.category === catConfig.key);
    if (catItems.length === 0) {
      return;
    }

    // Sección minimizada si el usuario la colapsó (excepto si hay búsqueda activa que fuerza apertura)
    const isCatMinimized = AppState.minimizedCategories.has(catConfig.key) && query.length < 2;
    const catDomId = `imbu-cat-section-${catConfig.key.replace(/\s+/g, '_')}`;

    fullHtml += `
      <section 
        class="imbu-category-section ${isCatMinimized ? 'minimized' : ''}" 
        id="${catDomId}" 
        data-cat-key="${escapeHtml(catConfig.key)}"
      >
        <!-- Encabezado de Categoría (Clic para Minimizar/Expandir la Categoría) -->
        <div 
          class="imbu-category-header" 
          onclick="toggleCategorySection('${escapeHtml(catConfig.key)}', event)"
          title="Haz clic para ${isCatMinimized ? 'expandir' : 'minimizar'} esta categoría"
        >
          <div class="imbu-category-header-left">
            <div class="imbu-cat-icon-badge">${catConfig.icon}</div>
            <div>
              <h3 class="imbu-cat-title-text">
                ${catConfig.titleHtml || escapeHtml(catConfig.title)}
                <span class="imbu-cat-count-pill">${catItems.length}</span>
              </h3>
              <p class="imbu-cat-desc-text">${escapeHtml(catConfig.desc)}</p>
            </div>
          </div>

          <div class="imbu-category-header-right">
            <div class="imbu-cat-minimize-btn">
              <span class="imbu-cat-min-text">${isCatMinimized ? 'Expandir' : 'Minimizar'}</span>
              <svg class="imbu-cat-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <!-- Contenedor de Filas de Imbuements de esta Categoría -->
        <div class="imbu-category-items">
          ${catItems.map(imbu => {
            let catClass = 'imbu-badge-attack';
            if (imbu.category === 'Basic Imbuements (Gold Token)') catClass = 'imbu-badge-basic';
            else if (imbu.category === 'Protective Imbuements') catClass = 'imbu-badge-protective';
            else if (imbu.category === 'Support Imbuements') catClass = 'imbu-badge-support';
            else if (imbu.category === 'Skill Improving Imbuements') catClass = 'imbu-badge-skill';

            const equipSlots = imbu.tiers && imbu.tiers[0] ? imbu.tiers[0].availableFor : '';

            const tiersToRender = selectedTier === 'all' 
              ? imbu.tiers 
              : imbu.tiers.filter(t => t.tier.toLowerCase() === selectedTier.toLowerCase());

            const isExpanded = (query.length >= 2) || AppState.expandedImbuements.has(imbu.id);

            const previewPillsHtml = imbu.tiers.map(t => {
              let tierCls = 'tier-basic';
              if (t.tier === 'Intricate') tierCls = 'tier-intricate';
              else if (t.tier === 'Powerful') tierCls = 'tier-powerful';
              return `<span class="imbu-preview-badge ${tierCls}">${escapeHtml(t.tier)} (${escapeHtml(t.effect)})</span>`;
            }).join('');

            return `
              <div class="imbu-list-row ${isExpanded ? 'expanded' : ''}" id="imbu-row-${escapeHtml(imbu.id)}" data-cat="${escapeHtml(imbu.category)}">
                <!-- Fila Encabezado Compacta -->
                <div class="imbu-row-header" onclick="toggleImbuement('${escapeHtml(imbu.id)}', event)" title="Haz clic para ver creature products y niveles">
                  <div class="imbu-row-left">
                    <div class="imbu-row-icon-wrap">
                      <img 
                        src="${escapeHtml(imbu.icon)}" 
                        alt="${escapeHtml(imbu.title)}" 
                        class="imbu-row-icon-img"
                        loading="lazy"
                        onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';"
                      >
                    </div>
                    <div class="imbu-row-info">
                      <div class="imbu-row-top-line">
                        <h4 class="imbu-row-title">${escapeHtml(imbu.title)}</h4>
                        <span class="imbu-badge-category ${catClass}">${imbu.category === 'Basic Imbuements (Gold Token)' ? `Imbuiments Basicos (Gold Token <img src="gold_token.png" class="imbu-badge-token-img" alt="Gold Token">)` : escapeHtml(imbu.categoryEs || imbu.category)}</span>
                      </div>
                      <div class="imbu-row-sub-line">
                        ${imbu.description ? `<span class="imbu-row-desc" title="${escapeHtml(imbu.description)}">${escapeHtml(imbu.description)}</span>` : ''}
                        ${equipSlots ? `<span class="imbu-row-slots-tag">🛡️ ${escapeHtml(equipSlots)}</span>` : ''}
                      </div>
                    </div>
                  </div>

                  <div class="imbu-row-right">
                    <div class="imbu-row-tier-previews">
                      ${previewPillsHtml}
                    </div>
                    <div class="imbu-row-toggle-action">
                      <span>Creature Products</span>
                      <svg class="imbu-chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>

                <!-- Cuerpo Desplegable: Creature Products y Niveles -->
                <div class="imbu-row-body">
                  <div class="imbu-expanded-tiers-grid">
                    ${tiersToRender.map(tier => {
                      let tierClass = 'tier-basic';
                      if (tier.tier === 'Intricate') tierClass = 'tier-intricate';
                      else if (tier.tier === 'Powerful') tierClass = 'tier-powerful';

                      return `
                        <div class="imbu-tier-card">
                          <div class="imbu-tier-top-row">
                            <div class="imbu-tier-name-wrap">
                              <span class="imbu-tier-pill ${tierClass}">${escapeHtml(tier.tier)}</span>
                              <strong style="color: var(--gold-light); font-size: 0.88rem;">${escapeHtml(tier.name)}</strong>
                              <span class="imbu-tier-effect">(${escapeHtml(tier.effect)})</span>
                            </div>
                          </div>

                          <!-- Chips de Creature Products Requeridos -->
                          <div class="imbu-sources-chips-row">
                            ${tier.sources.map(src => {
                              return `
                                <div 
                                  class="imbu-source-chip" 
                                  onclick="openItemDropsModal('${escapeHtml(src.name)}', '${escapeHtml(src.img)}', event)" 
                                  title="Haz clic para ver qué monstruos dropean '${escapeHtml(src.name)}'"
                                >
                                  <img 
                                    src="${escapeHtml(src.img)}" 
                                    alt="${escapeHtml(src.name)}" 
                                    class="imbu-source-sprite" 
                                    loading="lazy"
                                    onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';"
                                  >
                                  <span class="imbu-source-count">${src.count}x</span>
                                  <span class="imbu-source-name">${escapeHtml(src.name)}</span>
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>

                  <!-- Enlace a la sección oficial de este imbuement en TibiaWiki -->
                  <div class="imbu-card-footer-link">
                    <a 
                      href="https://tibia.fandom.com/wiki/Imbuing#${escapeHtml(imbu.id)}" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      class="imbu-card-wiki-link" 
                      onclick="openExternalWikiLink('https://tibia.fandom.com/wiki/Imbuing#${escapeHtml(imbu.id)}', event)"
                      title="Ver ${escapeHtml(imbu.title)} en TibiaWiki"
                    >
                      <img 
                        src="https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en" 
                        class="imbu-wiki-fav-small" 
                        alt="TibiaWiki"
                        onerror="this.style.display='none'"
                      >
                      <span>Ver ${escapeHtml(imbu.title)} en TibiaWiki ↗</span>
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  });

  container.innerHTML = fullHtml;
  checkAllToggledState();
}

// Modal Interactivo: ¿Qué monstruo dropea este Creature Product?
function openItemDropsModal(itemName, itemImg, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!itemName) return;

  const modal = document.getElementById('modal-item-drops');
  if (!modal) return;

  // Actualizar Título e Imagen
  const titleEl = document.getElementById('item-drops-modal-title');
  const imgEl = document.getElementById('item-drops-modal-img');
  const countBadgeEl = document.getElementById('item-drops-count-badge');
  const monstersContainer = document.getElementById('item-drops-monsters-list');
  const imbuContainer = document.getElementById('item-drops-imbuements-list');
  const btnSearchNpc = document.getElementById('btn-item-drops-search-npc');
  const linkWiki = document.getElementById('link-item-drops-wiki');

  if (titleEl) titleEl.textContent = itemName;
  if (imgEl) {
    imgEl.src = itemImg || 'https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';
    imgEl.alt = itemName;
  }

  // Lista de Monstruos desde la base de datos de TibiaWiki
  const dropsDb = AppState.creatureDrops || (typeof CREATURE_DROPS_DATA !== 'undefined' ? CREATURE_DROPS_DATA : {});
  const monsters = dropsDb[itemName] || [];

  if (countBadgeEl) {
    countBadgeEl.textContent = `${monsters.length} criatura${monsters.length === 1 ? '' : 's'}`;
  }

  if (monstersContainer) {
    if (monsters.length === 0) {
      monstersContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-dim); font-size: 0.88rem; background: rgba(0,0,0,0.2); border-radius: 6px;">
          <span>🔍</span> No se encontraron monstruos comunes registrados o se obtiene vía Quest/Evento especial.
        </div>
      `;
    } else {
      const spritesDb = AppState.monsterSprites || (typeof MONSTER_SPRITES_DATA !== 'undefined' ? MONSTER_SPRITES_DATA : {});
      monstersContainer.innerHTML = monsters.map(monster => {
        const spriteUrl = spritesDb[monster] || `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(monster.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

        return `
          <div 
            class="monster-drop-card" 
            onclick="openMonsterDetailModal('${escapeHtml(monster)}')"
            title="Ver ficha técnica completa de ${escapeHtml(monster)} (HP, Exp, Debilidades, Loot)"
          >
            <div class="monster-drop-card-left">
              <div class="monster-drop-sprite-box">
                <img 
                  src="${escapeHtml(spriteUrl)}" 
                  alt="${escapeHtml(monster)}" 
                  class="monster-drop-sprite-img" 
                  loading="lazy" 
                  onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';"
                >
              </div>
              <span class="monster-drop-name" title="${escapeHtml(monster)}">${escapeHtml(monster)}</span>
            </div>
            <div class="monster-drop-card-actions">
              <button 
                type="button" 
                class="monster-drop-action-btn"
                onclick="event.stopPropagation(); openMonsterDetailModal('${escapeHtml(monster)}');"
                title="Ver ficha completa de ${escapeHtml(monster)}"
              >
                <span>📜</span>
                <span>Ficha</span>
              </button>
              <button 
                type="button" 
                class="monster-drop-ext-btn" 
                onclick="event.stopPropagation(); openExternalWikiLink('https://tibia.fandom.com/wiki/${encodeURIComponent(monster.replace(/\s+/g, '_'))}', event);" 
                title="Abrir en TibiaWiki externa"
              >↗</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Encantamientos que requieren este material
  if (imbuContainer) {
    const allImbu = AppState.imbuements || [];
    const matchedImbu = [];

    allImbu.forEach(imbu => {
      const tiersWithItem = [];
      (imbu.tiers || []).forEach(t => {
        const srcMatch = (t.sources || []).find(s => s.name.toLowerCase() === itemName.toLowerCase());
        if (srcMatch) {
          tiersWithItem.push({ tier: t.tier, count: srcMatch.count });
        }
      });
      if (tiersWithItem.length > 0) {
        matchedImbu.push({
          title: imbu.title,
          category: imbu.categoryEs || imbu.category,
          icon: imbu.icon,
          tiers: tiersWithItem
        });
      }
    });

    if (matchedImbu.length === 0) {
      imbuContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.82rem;">Este material no figura en los encantamientos actuales.</span>`;
    } else {
      imbuContainer.innerHTML = matchedImbu.map(item => `
        <div class="imbu-compat-pill">
          <img src="${escapeHtml(item.icon)}" style="width: 18px; height: 18px; object-fit: contain;" />
          <strong>${escapeHtml(item.title)}:</strong>
          <span>${item.tiers.map(t => `${t.tier} (${t.count}x)`).join(', ')}</span>
        </div>
      `).join('');
    }
  }

  // Botón buscar NPC que compra/vende en el Rastreador
  if (btnSearchNpc) {
    btnSearchNpc.onclick = () => {
      closeModal('modal-item-drops');
      searchItemInNpcTracker(itemName);
    };
  }

  // Enlace a TibiaWiki del Item
  if (linkWiki) {
    linkWiki.href = `https://tibia.fandom.com/wiki/${encodeURIComponent(itemName.replace(/\s+/g, '_'))}`;
    linkWiki.title = `Abrir página de '${itemName}' en TibiaWiki`;
  }

  openModal('modal-item-drops');
}
window.openItemDropsModal = openItemDropsModal;

// Búsqueda cruzada de un item en el Rastreador de NPCs
function searchItemInNpcTracker(itemName, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!itemName) return;
  switchAppView('npcs');

  const searchInput = document.getElementById('search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');

  if (searchInput) {
    searchInput.value = itemName;
    AppState.searchQuery = itemName.toLowerCase().trim();
    if (btnClearSearch) btnClearSearch.style.display = 'flex';
  }

  AppState.searchMode = 'all';
  const modeButtons = document.querySelectorAll('.btn-mode-tab');
  modeButtons.forEach(btn => {
    if (btn.getAttribute('data-mode') === 'all') btn.classList.add('active');
    else btn.classList.remove('active');
  });

  renderApp();
  showToast(`🔍 Buscando NPCs que comercian "${itemName}"...`, 'info');
}

// ==========================================================================
// MÓDULO DE BESTIARIO & INFORMACIÓN DE MONSTRUOS DE TIBIA
// ==========================================================================

// Cargar base de datos de Monstruos
async function loadMonstersFromStorage() {
  let loaded = false;

  // 1. Objeto global pre-cargado desde monsters_data.js
  if (typeof MONSTERS_DATA !== 'undefined' && Object.keys(MONSTERS_DATA).length > 0) {
    AppState.monsters = MONSTERS_DATA;
    loaded = true;
  }

  // 2. Entorno Electron vía desktopAPI
  if (!loaded && window.desktopAPI && window.desktopAPI.loadMonstersData) {
    try {
      const resp = await window.desktopAPI.loadMonstersData();
      if (resp && Object.keys(resp).length > 0) {
        AppState.monsters = resp;
        loaded = true;
      }
    } catch (e) {
      console.warn('Error cargando monstruos desde desktopAPI:', e);
    }
  }

  // 3. Fallback estático
  if (!loaded) {
    try {
      const resStatic = await fetch('/monsters_data.json');
      if (resStatic.ok) {
        const dataStatic = await resStatic.json();
        if (dataStatic && Object.keys(dataStatic).length > 0) {
          AppState.monsters = dataStatic;
          loaded = true;
        }
      }
    } catch (err) {}
  }

  updateMonsterFilterControlsUI();
  renderMonsters();
  updateNavBadges();
}

// Inicializar UI y listeners de Monstruos
function initMonstersUI() {
  const tabMonsters = document.getElementById('tab-btn-monsters');
  if (tabMonsters) {
    tabMonsters.addEventListener('click', () => switchAppView('monsters'));
  }

  const searchInput = document.getElementById('monster-search-input');
  const btnClearSearch = document.getElementById('btn-clear-monster-search');
  const btnResetFilters = document.getElementById('btn-reset-monster-filters');

  function updateClearBtnVisibility() {
    if (btnClearSearch && searchInput) {
      btnClearSearch.style.display = searchInput.value.trim().length > 0 ? 'flex' : 'none';
    }
  }

  // Inicializar autocompletado en vivo (Monstruos, Bosses y Drops)
  initMonsterSearchAutocomplete();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.monsterFilter.query = e.target.value.toLowerCase().trim();
      AppState.monsterRenderLimit = 100;
      updateClearBtnVisibility();
      renderMonsters();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        AppState.monsterFilter.query = '';
        AppState.monsterRenderLimit = 100;
        updateClearBtnVisibility();
        hideMonsterSearchSuggestions();
        searchInput.focus();
        renderMonsters();
      }
    });
  }

  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      resetAllMonsterFilters();
    });
  }

  const diffButtons = document.querySelectorAll('.btn-monster-diff');
  const bossSelect = document.getElementById('monster-filter-boss');

  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetDiff = btn.getAttribute('data-diff') || 'all';
      const isAlreadyActive = btn.classList.contains('active');

      // Si se hace clic en un botón que ya está activo (ej: deseleccionar Bosses):
      if (isAlreadyActive && targetDiff !== 'all') {
        diffButtons.forEach(b => {
          if (b.getAttribute('data-diff') === 'all') b.classList.add('active');
          else b.classList.remove('active');
        });
        AppState.monsterFilter.difficulty = 'all';
        AppState.monsterFilter.boss = 'all';
        updateMonsterFilterControlsUI();
        AppState.monsterRenderLimit = 100;
        renderMonsters();
        return;
      }

      diffButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.monsterFilter.difficulty = targetDiff;

      if (targetDiff === 'boss') {
        AppState.monsterFilter.boss = 'bosses-all';
      } else {
        AppState.monsterFilter.boss = 'all';
      }

      updateMonsterFilterControlsUI();
      AppState.monsterRenderLimit = 100;
      renderMonsters();
    });
  });

  // Filtro por Bosstiary / Tipo de Boss
  if (bossSelect) {
    bossSelect.addEventListener('change', (e) => {
      AppState.monsterFilter.boss = e.target.value;
      AppState.monsterRenderLimit = 100;
      renderMonsters();
    });
  }



  // Filtro por Orden
  const sortSelect = document.getElementById('monster-filter-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      AppState.monsterFilter.sort = e.target.value;
      AppState.monsterRenderLimit = 100;
      renderMonsters();
    });
  }
}

// Restablecer todos los filtros de Monstruos a sus valores por defecto
function resetAllMonsterFilters() {
  const searchInput = document.getElementById('monster-search-input');
  if (searchInput) searchInput.value = '';
  const btnClearSearch = document.getElementById('btn-clear-monster-search');
  if (btnClearSearch) btnClearSearch.style.display = 'none';

  AppState.monsterFilter.query = '';
  AppState.monsterFilter.difficulty = 'all';
  AppState.monsterFilter.boss = 'all';
  AppState.monsterFilter.sort = 'name-asc';
  AppState.monsterRenderLimit = 100;

  // Actualizar botones de modo (Todos / Monstruos / Bosses)
  const diffButtons = document.querySelectorAll('.btn-monster-diff');
  diffButtons.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-diff') === 'all');
  });

  // Reset selects
  const bossSelect = document.getElementById('monster-filter-boss');
  if (bossSelect) bossSelect.value = 'bosses-all';
  const sortSelect = document.getElementById('monster-filter-sort');
  if (sortSelect) sortSelect.value = 'name-asc';

  hideMonsterSearchSuggestions();
  updateMonsterFilterControlsUI();
  renderMonsters();
}

// ========================================================
// DROPDOWN DE SUGERENCIAS DE MONSTRUOS, BOSSES Y DROPS
// ========================================================
let currentMonsterSuggestionsList = [];
let currentMonsterSuggestionSelectionIndex = -1;

function initMonsterSearchAutocomplete() {
  const searchInput = document.getElementById('monster-search-input');
  const dropdown = document.getElementById('monster-search-suggestions-dropdown');
  const btnClear = document.getElementById('btn-clear-monster-search');
  if (!searchInput || !dropdown) return;

  // Actualizar sugerencias en tiempo real al escribir
  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (btnClear) btnClear.style.display = q.length > 0 ? 'flex' : 'none';
    if (q.length >= 1) {
      renderMonsterSearchSuggestions(q);
    } else {
      hideMonsterSearchSuggestions();
    }
  });

  // Mostrar si el input ya tiene texto al hacer foco
  searchInput.addEventListener('focus', () => {
    const q = searchInput.value.trim();
    if (q.length >= 1) {
      renderMonsterSearchSuggestions(q);
    }
  });

  // Navegación por teclado (Flechas Arriba/Abajo, Enter, Escape)
  searchInput.addEventListener('keydown', (e) => {
    const isDropdownVisible = dropdown && dropdown.style.display !== 'none' && currentMonsterSuggestionsList.length > 0;

    if (e.key === 'ArrowDown') {
      if (!isDropdownVisible) return;
      e.preventDefault();
      currentMonsterSuggestionSelectionIndex = (currentMonsterSuggestionSelectionIndex + 1) % currentMonsterSuggestionsList.length;
      updateMonsterSuggestionSelectionHighlight();
    } else if (e.key === 'ArrowUp') {
      if (!isDropdownVisible) return;
      e.preventDefault();
      currentMonsterSuggestionSelectionIndex = (currentMonsterSuggestionSelectionIndex - 1 + currentMonsterSuggestionsList.length) % currentMonsterSuggestionsList.length;
      updateMonsterSuggestionSelectionHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isDropdownVisible && currentMonsterSuggestionSelectionIndex >= 0 && currentMonsterSuggestionSelectionIndex < currentMonsterSuggestionsList.length) {
        selectMonsterSearchSuggestion(currentMonsterSuggestionsList[currentMonsterSuggestionSelectionIndex]);
      } else if (isDropdownVisible && currentMonsterSuggestionsList.length === 1) {
        selectMonsterSearchSuggestion(currentMonsterSuggestionsList[0]);
      } else {
        hideMonsterSearchSuggestions();
        AppState.monsterFilter.query = searchInput.value.trim().toLowerCase();
        AppState.monsterRenderLimit = 100;
        updateMonsterFilterControlsUI();
        renderMonsters();
      }
    } else if (e.key === 'Escape') {
      hideMonsterSearchSuggestions();
    }
  });

  // Cerrar al hacer clic fuera del buscador y del dropdown
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      hideMonsterSearchSuggestions();
    }
  });
}

function updateMonsterSuggestionSelectionHighlight() {
  const dropdown = document.getElementById('monster-search-suggestions-dropdown');
  if (!dropdown) return;
  const items = dropdown.querySelectorAll('.suggestion-item');
  items.forEach((item, idx) => {
    if (idx === currentMonsterSuggestionSelectionIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

function hideMonsterSearchSuggestions() {
  const dropdown = document.getElementById('monster-search-suggestions-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  currentMonsterSuggestionSelectionIndex = -1;
  currentMonsterSuggestionsList = [];
}

function getMonsterSearchSuggestionsData(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return { monsters: [], bosses: [], items: [] };

  const monstersList = Object.values(AppState.monsters || {});
  const spritesDb = AppState.monsterSprites || (typeof MONSTER_SPRITES_DATA !== 'undefined' ? MONSTER_SPRITES_DATA : {});

  const monsterMatches = [];
  const bossMatches = [];
  const itemMap = new Map();

  const isWordPrefixMatch = (targetText, queryStr) => {
    if (!targetText || !queryStr) return false;
    return typeof matchesPrefixSequence === 'function' 
      ? matchesPrefixSequence(targetText, queryStr)
      : targetText.toLowerCase().includes(queryStr.toLowerCase());
  };

  monstersList.forEach(m => {
    const name = m.name || '';
    const nameLower = name.toLowerCase();
    const isBoss = !!m.isBoss;

    // Verificar coincidencia en nombre de la criatura
    let isNameMatch = isWordPrefixMatch(name, q);
    if (!isNameMatch && q.length >= 3 && nameLower.includes(q)) {
      isNameMatch = true;
    }

    if (isNameMatch) {
      let score = 10;
      if (nameLower === q) score = 100;
      else if (nameLower.startsWith(q)) score = 60;
      else if (isWordPrefixMatch(name, q)) score = 35;
      else score = 15;

      const spriteUrl = m.sprite || spritesDb[name] || `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(name.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

      if (isBoss) {
        bossMatches.push({
          type: 'boss',
          name,
          spriteUrl,
          bosstiary: m.bosstiaryclass || m.bossCategory || 'Boss',
          cooldown: m.cooldown || '',
          hp: typeof m.hp === 'number' ? m.hp.toLocaleString() : (m.hp || '?'),
          exp: typeof m.exp === 'number' ? m.exp.toLocaleString() : (m.exp || '?'),
          score
        });
      } else {
        monsterMatches.push({
          type: 'monster',
          name,
          spriteUrl,
          hp: typeof m.hp === 'number' ? m.hp.toLocaleString() : (m.hp || '?'),
          exp: typeof m.exp === 'number' ? m.exp.toLocaleString() : (m.exp || '?'),
          charm: m.charm || '?',
          location: m.location || (m.spawns && m.spawns[0] ? m.spawns[0].name : 'Tibia'),
          score
        });
      }
    }

    // Escanear Drops / Loot de esta criatura
    (m.loot || []).forEach(l => {
      const itemName = (l.item || '').trim();
      if (!itemName) return;
      const itemLower = itemName.toLowerCase();

      let isDropMatch = isWordPrefixMatch(itemName, q);
      if (!isDropMatch && q.length >= 3 && itemLower.includes(q)) {
        isDropMatch = true;
      }

      if (isDropMatch) {
        if (!itemMap.has(itemLower)) {
          let score = 10;
          if (itemLower === q) score = 100;
          else if (itemLower.startsWith(q)) score = 60;
          else if (isWordPrefixMatch(itemName, q)) score = 35;
          else score = 15;

          const isImbu = (m.imbuementDrops && m.imbuementDrops.includes(itemName)) || 
                         (AppState.creatureDrops && AppState.creatureDrops[itemName]);

          const iconUrl = typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl
            ? TibiaScraper.getFandomItemIconUrl(itemName)
            : `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(itemName.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

          itemMap.set(itemLower, {
            type: 'item',
            name: itemName,
            iconUrl,
            isImbu: !!isImbu,
            droppedBy: [],
            raritySamples: [],
            score
          });
        }

        const entry = itemMap.get(itemLower);
        if (!entry.droppedBy.includes(name)) {
          entry.droppedBy.push(name);
          if (l.rarity && !entry.raritySamples.includes(l.rarity)) {
            entry.raritySamples.push(l.rarity);
          }
        }
      }
    });

    // Escanear ImbuementDrops si no estaban en m.loot
    (m.imbuementDrops || []).forEach(dropName => {
      const itemName = (dropName || '').trim();
      if (!itemName) return;
      const itemLower = itemName.toLowerCase();

      let isDropMatch = isWordPrefixMatch(itemName, q);
      if (!isDropMatch && q.length >= 3 && itemLower.includes(q)) {
        isDropMatch = true;
      }

      if (isDropMatch) {
        if (!itemMap.has(itemLower)) {
          let score = 10;
          if (itemLower === q) score = 100;
          else if (itemLower.startsWith(q)) score = 60;
          else if (isWordPrefixMatch(itemName, q)) score = 35;
          else score = 15;

          const iconUrl = typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl
            ? TibiaScraper.getFandomItemIconUrl(itemName)
            : `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(itemName.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

          itemMap.set(itemLower, {
            type: 'item',
            name: itemName,
            iconUrl,
            isImbu: true,
            droppedBy: [],
            raritySamples: [],
            score
          });
        }

        const entry = itemMap.get(itemLower);
        if (!entry.droppedBy.includes(name)) {
          entry.droppedBy.push(name);
        }
      }
    });
  });

  const itemMatches = Array.from(itemMap.values());

  monsterMatches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  bossMatches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  itemMatches.sort((a, b) => b.score - a.score || b.droppedBy.length - a.droppedBy.length || a.name.localeCompare(b.name));

  return {
    monsters: monsterMatches.slice(0, 12),
    bosses: bossMatches.slice(0, 8),
    items: itemMatches.slice(0, 8)
  };
}

function renderMonsterSearchSuggestions(query) {
  const dropdown = document.getElementById('monster-search-suggestions-dropdown');
  if (!dropdown) return;

  const data = getMonsterSearchSuggestionsData(query);
  const totalMatches = data.monsters.length + data.bosses.length + data.items.length;

  if (totalMatches === 0) {
    dropdown.innerHTML = `
      <div class="suggestion-empty">
        No se encontraron monstruos, bosses o drops con "<strong>${escapeHtml(query)}</strong>"
      </div>
    `;
    dropdown.style.display = 'flex';
    currentMonsterSuggestionsList = [];
    currentMonsterSuggestionSelectionIndex = -1;
    return;
  }

  currentMonsterSuggestionsList = [];
  let html = '';

  // 1. Sección de Monstruos
  if (data.monsters.length > 0) {
    html += `
      <div class="suggestion-section-title" style="border-bottom-color: rgba(16, 185, 129, 0.3);">
        <span style="color: #34d399;">👾 Monstruos Encontrados (${data.monsters.length})</span>
        <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-dim);">Haz clic para abrir ficha</span>
      </div>
    `;

    data.monsters.forEach(m => {
      const idx = currentMonsterSuggestionsList.length;
      currentMonsterSuggestionsList.push(m);

      html += `
        <div class="suggestion-item" data-index="${idx}">
          <div class="suggestion-icon-box" style="border-radius: 8px;">
            <img src="${escapeHtml(m.spriteUrl)}" alt="${escapeHtml(m.name)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';">
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name-row">
              <span class="suggestion-name">${highlightMatch(m.name, query)}</span>
              <span class="suggestion-badge-type badge-type-monster">Monstruo</span>
            </div>
            <div class="suggestion-details">
              <span class="suggestion-stat-pill pill-hp">❤️ ${m.hp} HP</span>
              <span class="suggestion-stat-pill pill-exp">⚡ ${m.exp} Exp</span>
              <span class="suggestion-stat-pill pill-charm">⭐ ${m.charm} pts</span>
              ${m.location ? `<span>📍 ${escapeHtml(m.location)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  // 2. Sección de Bosses
  if (data.bosses.length > 0) {
    html += `
      <div class="suggestion-section-title" style="border-bottom-color: rgba(239, 68, 68, 0.35);">
        <span style="color: #f87171;">👑 Bosses & Bosstiary (${data.bosses.length})</span>
        <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-dim);">Haz clic para abrir ficha</span>
      </div>
    `;

    data.bosses.forEach(b => {
      const idx = currentMonsterSuggestionsList.length;
      currentMonsterSuggestionsList.push(b);

      html += `
        <div class="suggestion-item" data-index="${idx}">
          <div class="suggestion-icon-box" style="border-radius: 8px; border-color: rgba(239, 68, 68, 0.35);">
            <img src="${escapeHtml(b.spriteUrl)}" alt="${escapeHtml(b.name)}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';">
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name-row">
              <span class="suggestion-name" style="color: #fca5a5;">
                <span class="suggestion-boss-skull">💀</span>${highlightMatch(b.name, query)}
              </span>
              <span class="suggestion-badge-type badge-type-boss">Boss</span>
            </div>
            <div class="suggestion-details">
              <span>👑 <strong>${escapeHtml(b.bosstiary)}</strong></span>
              <span class="suggestion-stat-pill pill-hp">❤️ ${b.hp} HP</span>
              <span class="suggestion-stat-pill pill-exp">⚡ ${b.exp} Exp</span>
              ${b.cooldown ? `<span>⏱️ Cooldown: <strong style="color: #fde047;">${escapeHtml(b.cooldown)}</strong></span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  // 3. Sección de Drops & Items
  if (data.items.length > 0) {
    html += `
      <div class="suggestion-section-title" style="border-bottom-color: rgba(229, 185, 59, 0.35);">
        <span style="color: #fde047;">🎒 Drops & Items (${data.items.length})</span>
        <span style="font-size: 0.7rem; font-weight: 500; color: var(--text-dim);">Haz clic para filtrar criaturas</span>
      </div>
    `;

    data.items.forEach(item => {
      const idx = currentMonsterSuggestionsList.length;
      currentMonsterSuggestionsList.push(item);

      const dropCount = item.droppedBy.length;
      const topDroppers = item.droppedBy.slice(0, 3).join(', ');
      const extraDroppers = dropCount > 3 ? ` y ${dropCount - 3} más` : '';

      html += `
        <div class="suggestion-item" data-index="${idx}">
          <div class="suggestion-icon-box" style="background: rgba(0, 0, 0, 0.6);">
            <img src="${escapeHtml(item.iconUrl)}" alt="${escapeHtml(item.name)}" referrerpolicy="no-referrer" loading="lazy" onerror="handleItemImageError(this)">
          </div>
          <div class="suggestion-info">
            <div class="suggestion-name-row">
              <span class="suggestion-name">${highlightMatch(item.name, query)}</span>
              <span class="suggestion-badge-type ${item.isImbu ? 'badge-type-item' : 'badge-type-loot'}">
                ${item.isImbu ? 'Imbuement' : 'Drop'}
              </span>
            </div>
            <div class="suggestion-details">
              <span>🎯 Soltado por <strong>${dropCount} ${dropCount === 1 ? 'criatura' : 'criaturas'}</strong>: <span style="color: var(--text-light);">${escapeHtml(topDroppers + extraDroppers)}</span></span>
              ${item.raritySamples.length > 0 ? `<span style="color: var(--gold-light);">• ${escapeHtml(item.raritySamples.slice(0, 2).join(', '))}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    });
  }

  dropdown.innerHTML = html;
  dropdown.style.display = 'flex';
  currentMonsterSuggestionSelectionIndex = -1;

  // Clicks en sugerencias
  dropdown.querySelectorAll('.suggestion-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(el.getAttribute('data-index'), 10);
      if (currentMonsterSuggestionsList[idx]) {
        selectMonsterSearchSuggestion(currentMonsterSuggestionsList[idx]);
      }
    });
  });
}

function selectMonsterSearchSuggestion(item) {
  const searchInput = document.getElementById('monster-search-input');
  if (!searchInput) return;

  hideMonsterSearchSuggestions();

  if (item.type === 'monster' || item.type === 'boss') {
    searchInput.value = item.name;
    AppState.monsterFilter.query = item.name.toLowerCase().trim();
    const btnClear = document.getElementById('btn-clear-monster-search');
    if (btnClear) btnClear.style.display = 'flex';

    updateMonsterFilterControlsUI();
    renderMonsters();
    openMonsterDetailModal(item.name);
  } else if (item.type === 'item') {
    searchInput.value = item.name;
    AppState.monsterFilter.query = item.name.toLowerCase().trim();
    const btnClear = document.getElementById('btn-clear-monster-search');
    if (btnClear) btnClear.style.display = 'flex';

    // Si estaba filtrando por dificultad estricta y el drop viene de ambos, resetear a 'all'
    if (AppState.monsterFilter.difficulty !== 'all') {
      AppState.monsterFilter.difficulty = 'all';
      const diffButtons = document.querySelectorAll('.btn-monster-diff');
      diffButtons.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-diff') === 'all');
      });
    }

    AppState.monsterRenderLimit = 100;
    updateMonsterFilterControlsUI();
    renderMonsters();
  }
}

// Helper para escapar expresiones regulares
function escapeRegex(str) {
  if (!str) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Actualizar la visibilidad y opciones de los controles según el modo (Todos vs Monstruos vs Bosses)
function updateMonsterFilterControlsUI() {
  const isBossView = AppState.monsterFilter.difficulty === 'boss';
  const groupBoss = document.getElementById('group-filter-boss');
  const bossSelect = document.getElementById('monster-filter-boss');

  // El selector de Bosstiary / Categorías de Boss solo se muestra en modo Bosses
  if (groupBoss) {
    groupBoss.style.display = isBossView ? 'flex' : 'none';
  }

  if (isBossView) {
    if (bossSelect) {
      if (!AppState.monsterFilter.boss || AppState.monsterFilter.boss === 'all') {
        AppState.monsterFilter.boss = 'bosses-all';
      }
      bossSelect.value = AppState.monsterFilter.boss;
    }
  } else {
    AppState.monsterFilter.boss = 'all';
  }
}



// Resuelve inteligentemente los spawns para una criatura basándose en su ubicación de TibiaWiki
function resolveSpawnForLocation(locationStr) {
  const loc = (locationStr || '').trim();
  const locClean = loc.replace(/[\[\]]/g, '').trim();
  const locLower = locClean.toLowerCase();

  const CANONICAL_MAP = [
    { key: 'crystal enigma', name: 'Crystal Enigma', city: 'Gnomprona', coords: { x: 33546, y: 32911, z: 8 }, mapUrl: 'https://tibiamaps.io/map#33546,32911,8:2' },
    { key: 'monster graveyard', name: 'Monster Graveyard', city: 'Gnomprona', coords: { x: 33718, y: 32832, z: 8 }, mapUrl: 'https://tibiamaps.io/map#33718,32832,8:2' },
    { key: 'sparkling pools', name: 'Sparkling Pools', city: 'Marapur / Gnomprona', coords: { x: 33800, y: 32700, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33800,32700,7:2' },
    { key: 'gnomprona', name: 'Gnomprona', city: 'Gnomprona', coords: { x: 33400, y: 32800, z: 12 }, mapUrl: 'https://tibiamaps.io/map#33400,32800,12:2' },
    { key: 'candia', name: 'Candia', city: 'Candia', coords: { x: 33500, y: 32200, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33500,32200,7:2' },
    { key: 'chocolate mines', name: 'Chocolate Mines', city: 'Candia', coords: { x: 33520, y: 32180, z: 8 }, mapUrl: 'https://tibiamaps.io/map#33520,32180,8:2' },
    { key: 'isle of evil', name: 'Isle of Evil', city: 'Isle of Evil', coords: { x: 32700, y: 31400, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32700,31400,7:2' },
    { key: 'tibiadrome', name: 'Tibiadrome', city: 'Tibiadrome', coords: { x: 32369, y: 32241, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32369,32241,7:2' },
    { key: 'ferumbras', name: "Ferumbras' Citadel", city: 'Kharos', coords: { x: 32121, y: 32688, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32121,32688,7:2' },
    { key: 'pits of inferno', name: 'Pits of Inferno', city: 'Plains of Havoc', coords: { x: 32800, y: 32330, z: 11 }, mapUrl: 'https://tibiamaps.io/map#32800,32330,11:2' },
    { key: 'inquisition', name: 'The Inquisition Quest', city: 'Plains of Havoc', coords: { x: 32800, y: 32300, z: 12 }, mapUrl: 'https://tibiamaps.io/map#32800,32300,12:2' },
    { key: 'annihilator', name: 'The Annihilator', city: 'Edron', coords: { x: 33220, y: 31670, z: 13 }, mapUrl: 'https://tibiamaps.io/map#33220,31670,13:2' },
    { key: 'roshamuul', name: 'Roshamuul', city: 'Roshamuul', coords: { x: 33600, y: 32350, z: 10 }, mapUrl: 'https://tibiamaps.io/map#33600,32350,10:2' },
    { key: 'feyrist', name: 'Feyrist', city: 'Feyrist', coords: { x: 33510, y: 32229, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33510,32229,7:2' },
    { key: 'bounac', name: 'Bounac', city: 'Bounac', coords: { x: 33750, y: 31950, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33750,31950,7:2' },
    { key: 'ingol', name: 'Ingol', city: 'Bounac', coords: { x: 33700, y: 31500, z: 9 }, mapUrl: 'https://tibiamaps.io/map#33700,31500,9:2' },
    { key: 'marapur', name: 'Marapur', city: 'Marapur', coords: { x: 33800, y: 32700, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33800,32700,7:2' },
    { key: 'issavi', name: 'Issavi', city: 'Issavi', coords: { x: 33900, y: 31450, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33900,31450,7:2' },
    { key: 'falcon bastion', name: 'Falcon Bastion', city: 'Falcon Bastion', coords: { x: 33362, y: 31343, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33362,31343,7:2' },
    { key: 'cobra bastion', name: 'Cobra Bastion', city: 'Cobra Bastion', coords: { x: 33301, y: 32647, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33301,32647,7:2' },
    { key: 'thais', name: 'Thais', city: 'Thais', coords: { x: 32365, y: 32224, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32365,32224,7:2' },
    { key: 'carlin', name: 'Carlin', city: 'Carlin', coords: { x: 32360, y: 31782, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32360,31782,7:2' },
    { key: 'venore', name: 'Venore', city: 'Venore', coords: { x: 32957, y: 32076, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32957,32076,7:2' },
    { key: 'edron', name: 'Edron', city: 'Edron', coords: { x: 33217, y: 31814, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33217,31814,7:2' },
    { key: 'kazordoon', name: 'Kazordoon', city: 'Kazordoon', coords: { x: 32649, y: 31925, z: 8 }, mapUrl: 'https://tibiamaps.io/map#32649,31925,8:2' },
    { key: 'darashia', name: 'Darashia', city: 'Darashia', coords: { x: 33213, y: 32454, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33213,32454,7:2' },
    { key: 'ankrahmun', name: 'Ankrahmun', city: 'Ankrahmun', coords: { x: 33194, y: 32853, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33194,32853,7:2' },
    { key: 'liberty bay', name: 'Liberty Bay', city: 'Liberty Bay', coords: { x: 32317, y: 32826, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32317,32826,7:2' },
    { key: 'port hope', name: 'Port Hope', city: 'Port Hope', coords: { x: 32594, y: 32744, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32594,32744,7:2' },
    { key: 'svargrond', name: 'Svargrond', city: 'Svargrond', coords: { x: 32212, y: 31132, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32212,31132,7:2' },
    { key: 'yalahar', name: 'Yalahar', city: 'Yalahar', coords: { x: 32787, y: 31276, z: 7 }, mapUrl: 'https://tibiamaps.io/map#32787,31276,7:2' },
    { key: 'gray beach', name: 'Gray Beach', city: 'Gray Beach', coords: { x: 33447, y: 31322, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33447,31322,7:2' },
    { key: 'rathleton', name: 'Rathleton', city: 'Rathleton', coords: { x: 33594, y: 31899, z: 6 }, mapUrl: 'https://tibiamaps.io/map#33594,31899,6:2' },
    { key: 'krailos', name: 'Krailos', city: 'Krailos', coords: { x: 33650, y: 31650, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33650,31650,7:2' },
    { key: 'zao', name: 'Zao', city: 'Farmine / Zao', coords: { x: 33200, y: 31400, z: 7 }, mapUrl: 'https://tibiamaps.io/map#33200,31400,7:2' }
  ];

  for (const item of CANONICAL_MAP) {
    if (locLower.includes(item.key)) {
      return [{
        name: item.name,
        city: item.city,
        desc: `Zona oficial en ${item.name} (TibiaWiki)`,
        coords: item.coords,
        mapUrl: item.mapUrl
      }];
    }
  }

  if (locClean && locClean !== '?' && locLower !== 'unknown' && locLower !== 'nowhere.' && locLower !== 'none' && locLower !== 'tibia') {
    return [{
      name: locClean.length > 35 ? locClean.slice(0, 35) + '...' : locClean,
      city: 'Tibia',
      desc: `Ubicación registrada: ${locClean} (TibiaWiki)`,
      coords: { x: 32369, y: 32241, z: 7 },
      mapUrl: 'https://tibiamaps.io/map#32369,32241,7:2'
    }];
  }

  return [{
    name: 'Continente de Tibia',
    city: 'Tibia',
    desc: 'Ubicación común o dungeons en todo el continente de Tibia.',
    coords: { x: 32369, y: 32241, z: 7 },
    mapUrl: 'https://tibiamaps.io/map#32369,32241,7:2'
  }];
}

// Renderizado principal de Tarjetas de Monstruos
function renderMonsters() {
  const container = document.getElementById('monsters-cards-grid');
  const counterEl = document.getElementById('monsters-results-counter');
  const countDiffAllEl = document.getElementById('count-diff-all');
  const countDiffRegularEl = document.getElementById('count-diff-regular');
  const countDiffBossEl = document.getElementById('count-diff-boss');
  if (!container) return;

  const allMonstersMap = AppState.monsters || {};
  let list = Object.values(allMonstersMap);

  const totalRegular = list.filter(m => !m.isBoss).length;
  const totalBosses = list.filter(m => m.isBoss).length;
  const totalAll = list.length;

  if (countDiffAllEl) {
    countDiffAllEl.textContent = totalAll.toLocaleString();
  }

  if (countDiffRegularEl) {
    countDiffRegularEl.textContent = totalRegular.toLocaleString();
  }

  if (countDiffBossEl) {
    countDiffBossEl.textContent = totalBosses.toLocaleString();
  }

  // Actualizar visibilidad del botón para restablecer filtros
  const btnResetMonsterFiltersEl = document.getElementById('btn-reset-monster-filters');
  if (btnResetMonsterFiltersEl) {
    const isFiltered = !!(
      (AppState.monsterFilter.query && AppState.monsterFilter.query.trim().length > 0) ||
      AppState.monsterFilter.difficulty !== 'all' ||
      (AppState.monsterFilter.boss && AppState.monsterFilter.boss !== 'all' && AppState.monsterFilter.boss !== 'bosses-all') ||
      (AppState.monsterFilter.sort && AppState.monsterFilter.sort !== 'name-asc')
    );
    btnResetMonsterFiltersEl.style.display = isFiltered ? 'inline-flex' : 'none';
  }

  const { query, difficulty, boss: bossFilter, sort } = AppState.monsterFilter;

  // FILTRADO: TODOS vs MONSTRUOS REGULARES vs BOSSES
  const isBossView = difficulty === 'boss';
  const isRegularView = difficulty === 'regular';
  if (isBossView) {
    list = list.filter(m => !!m.isBoss);
  } else if (isRegularView) {
    list = list.filter(m => !m.isBoss);
  }
  // Si difficulty === 'all', muestra todos (monstruos y bosses combinados)

  // Filtrado por búsqueda de texto (nombre, boss o loot)
  if (query) {
    const q = query.trim().toLowerCase();
    const escaped = escapeRegex(q);
    const root = q.endsWith('s') && q.length > 3 ? q.slice(0, -1) : q;
    const escapedRoot = escapeRegex(root);
    // Regex inteligente por prefijo/límite de palabra (evita que "grapes" o "shapeshifters" coincidan al buscar "apes")
    const wordPrefixRegex = new RegExp(`\\b(${escaped}|${escapedRoot})`, 'i');

    list = list.filter(m => {
      const matchName = m.name && (wordPrefixRegex.test(m.name) || (q.length >= 3 && m.name.toLowerCase().includes(q)));
      const matchBossCat = m.bossCategory && wordPrefixRegex.test(m.bossCategory);
      const matchBosstiary = m.bosstiaryclass && wordPrefixRegex.test(m.bosstiaryclass);
      const matchLoot = (m.loot || []).some(l => l.item && (wordPrefixRegex.test(l.item) || (q.length >= 3 && l.item.toLowerCase().includes(q))));
      const matchImbu = (m.imbuementDrops || []).some(drop => wordPrefixRegex.test(drop) || (q.length >= 3 && drop.toLowerCase().includes(q)));
      return matchName || matchBossCat || matchBosstiary || matchLoot || matchImbu;
    });
  }


  // Filtrado por Bosstiary / Tipo de Boss (solo cuando se visualizan Bosses)
  if (isBossView && bossFilter && bossFilter !== 'all') {
    if (bossFilter === 'bane') {
      list = list.filter(m => m.bosstiaryclass === 'Bane');
    } else if (bossFilter === 'archfoe') {
      list = list.filter(m => m.bosstiaryclass === 'Archfoe');
    } else if (bossFilter === 'nemesis') {
      list = list.filter(m => m.bosstiaryclass === 'Nemesis');
    } else if (bossFilter === 'cooldown') {
      list = list.filter(m => !!m.cooldown);
    } else if (bossFilter === 'arena') {
      list = list.filter(m => m.bossCategory === 'Arena Boss');
    } else if (bossFilter === 'raid') {
      list = list.filter(m => m.bossCategory === 'Raid Boss' || m.isRaid);
    }
  }

  // Ordenamiento (con prioridad de relevancia por nombre de criatura si hay búsqueda activa)
  let searchWordRegex = null;
  if (query) {
    const qClean = query.trim().toLowerCase();
    const esc = escapeRegex(qClean);
    const rt = qClean.endsWith('s') && qClean.length > 3 ? qClean.slice(0, -1) : qClean;
    const escRt = escapeRegex(rt);
    searchWordRegex = new RegExp(`\\b(${esc}|${escRt})`, 'i');
  }

  list.sort((a, b) => {
    if (query && searchWordRegex) {
      const qLower = query.toLowerCase().trim();
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();

      let weightA = 0;
      if (aLower === qLower) weightA = 100;
      else if (aLower.startsWith(qLower)) weightA = 80;
      else if (searchWordRegex.test(a.name)) weightA = 60;
      else if (aLower.includes(qLower)) weightA = 40;

      let weightB = 0;
      if (bLower === qLower) weightB = 100;
      else if (bLower.startsWith(qLower)) weightB = 80;
      else if (searchWordRegex.test(b.name)) weightB = 60;
      else if (bLower.includes(qLower)) weightB = 40;

      if (weightA !== weightB) {
        return weightB - weightA;
      }
    }

    const hpA = typeof a.hp === 'number' ? a.hp : 0;
    const hpB = typeof b.hp === 'number' ? b.hp : 0;
    const expA = typeof a.exp === 'number' ? a.exp : 0;
    const expB = typeof b.exp === 'number' ? b.exp : 0;
    const charmA = typeof a.charm === 'number' ? a.charm : 0;
    const charmB = typeof b.charm === 'number' ? b.charm : 0;

    switch (sort) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'hp-desc':
        return hpB - hpA;
      case 'hp-asc':
        return hpA - hpB;
      case 'exp-desc':
        return expB - expA;
      case 'exp-asc':
        return expA - expB;
      case 'charm-desc':
        return charmB - charmA;
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const RENDER_BATCH = 100;
  const currentLimit = AppState.monsterRenderLimit || RENDER_BATCH;
  const visibleList = list.slice(0, currentLimit);

  if (counterEl) {
    const isFiltered = query || (isBossView && bossFilter && bossFilter !== 'all' && bossFilter !== 'bosses-all');
    let entityLabel = 'criaturas';
    if (isBossView) {
      entityLabel = list.length === 1 ? 'boss' : 'bosses';
    } else if (isRegularView) {
      entityLabel = list.length === 1 ? 'monstruo' : 'monstruos';
    } else {
      entityLabel = list.length === 1 ? 'criatura' : 'criaturas (monstruos y bosses)';
    }
    if (list.length > currentLimit) {
      counterEl.textContent = `Mostrando ${visibleList.length.toLocaleString()} de ${list.length.toLocaleString()} ${entityLabel}${isFiltered ? ' (filtrados)' : ''}`;
    } else {
      counterEl.textContent = `Mostrando ${list.length.toLocaleString()} ${entityLabel}${isFiltered ? ' (filtrados)' : ''}`;
    }
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center; color: var(--text-dim); background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px dashed rgba(255,255,255,0.1);">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem;">🔍</span>
        <h4 style="color: var(--gold-light); margin: 0 0 0.4rem 0;">No se encontraron monstruos</h4>
        <p style="font-size: 0.88rem; margin: 0;">Prueba a modificar tus criterios de búsqueda o dificultad.</p>
      </div>
    `;
    return;
  }

  // Renderizar tarjetas
  const spritesDb = AppState.monsterSprites || (typeof MONSTER_SPRITES_DATA !== 'undefined' ? MONSTER_SPRITES_DATA : {});

  let cardsHtml = visibleList.map(m => {
    const spriteUrl = m.sprite || spritesDb[m.name] || `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(m.name.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

    return `
      <div 
        class="monster-card ${m.isBoss ? 'is-boss-card' : ''}" 
        data-monster-name="${escapeHtml(m.name)}"
        onclick="openMonsterDetailModal(this.getAttribute('data-monster-name'))"
        title="Clic para ver la ficha completa de ${escapeHtml(m.name)}"
      >
        ${m.isBoss ? `
          <div class="boss-red-skull-badge" title="¡Boss de Tibia!">
            <svg class="boss-red-skull-icon" viewBox="0 0 512 512" aria-hidden="true">
              <path fill="#ff2a2a" d="M416 398.9c58.5-41.1 96-104.1 96-174.9C512 100.3 397.4 0 256 0S0 100.3 0 224c0 70.7 37.5 133.8 96 174.9V448c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32V416h128v32c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32v-49.1zM160 256c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm96 72c-13.3 0-24-10.7-24-24 0-8 4-15.3 10.3-19.8l13.7-9.8 13.7 9.8c6.3 4.5 10.3 11.8 10.3 19.8 0 13.3-10.7 24-24 24zm96-72c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48z"/>
            </svg>
            <span class="boss-red-skull-label">BOSS</span>
          </div>
        ` : ''}
        <div class="monster-card-sprite-box">
          <img 
            src="${escapeHtml(spriteUrl)}" 
            alt="${escapeHtml(m.name)}" 
            class="monster-card-sprite-img" 
            loading="lazy"
            onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';"
          >
        </div>
        <div class="monster-card-info">
          <h4 class="monster-card-name" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</h4>
        </div>
      </div>
    `;
  }).join('');

  if (list.length > currentLimit) {
    const remaining = list.length - currentLimit;
    cardsHtml += `
      <div class="monsters-load-more-wrap" style="grid-column: 1 / -1; display: flex; justify-content: center; padding: 2rem 1rem 3rem 1rem;">
        <button 
          type="button" 
          id="btn-load-more-monsters" 
          class="btn btn-secondary" 
          style="padding: 0.85rem 2.2rem; font-size: 0.95rem; font-weight: 600; background: rgba(229, 185, 59, 0.12); border: 1px solid var(--gold, #e5b93b); color: var(--gold-light, #fde68a); border-radius: 8px; cursor: pointer; transition: all 0.2s;"
          onclick="AppState.monsterRenderLimit = (AppState.monsterRenderLimit || 100) + 100; renderMonsters();"
        >
          ⬇️ Cargar más criaturas (${remaining.toLocaleString()} restantes de ${list.length.toLocaleString()})
        </button>
      </div>
    `;
  }

  container.innerHTML = cardsHtml;
}

// ==========================================
// VISOR DE MAPA LIMPIO DE MONSTRUOS (SOLO SE VE EL MAPA)
// ==========================================
let currentMonsterMapSpawns = [];
let currentMonsterMapIndex = 0;
let currentMonsterMapName = '';

function openMonsterMapModal(monsterName, spawnIndex = 0) {
  if (!monsterName) return;
  const modal = document.getElementById('modal-monster-map');
  if (!modal) return;

  const monstersDb = AppState.monsters || (typeof MONSTERS_DATA !== 'undefined' ? MONSTERS_DATA : {});
  const m = monstersDb[monsterName] || {
    name: monsterName,
    spawns: []
  };

  const spritesDb = AppState.monsterSprites || (typeof MONSTER_SPRITES_DATA !== 'undefined' ? MONSTER_SPRITES_DATA : {});
  const spriteUrl = m.sprite || spritesDb[monsterName] || `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(monsterName.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

  currentMonsterMapName = monsterName;
  currentMonsterMapSpawns = (m.spawns && m.spawns.length > 0) ? m.spawns : [
    {
      name: 'Continente de Tibia',
      city: 'Tibia',
      desc: m.location || 'Dungeons y zonas salvajes de Tibia',
      coords: { x: 32369, y: 32241, z: 7 },
      mapUrl: 'https://tibiamaps.io/map#32369,32241,7:2'
    }
  ];

  const titleEl = document.getElementById('monster-map-clean-title');
  const spriteEl = document.getElementById('monster-map-clean-sprite');
  const chipsContainer = document.getElementById('monster-map-clean-chips');

  if (titleEl) {
    titleEl.textContent = `🗺️ Mapa: ${monsterName}`;
  }
  if (spriteEl) {
    spriteEl.src = spriteUrl;
    spriteEl.alt = monsterName;
    spriteEl.style.display = 'block';
  }

  // Si tiene más de 1 zona, mostrar selector compacto de chips
  if (chipsContainer) {
    if (currentMonsterMapSpawns.length > 1) {
      chipsContainer.style.display = 'flex';
      chipsContainer.innerHTML = currentMonsterMapSpawns.map((s, idx) => `
        <button 
          type="button" 
          class="monster-clean-chip-btn ${idx === spawnIndex ? 'active' : ''}" 
          onclick="switchMonsterMapZone(${idx})"
          title="${escapeHtml(s.desc || s.name)}"
        >
          <span>📍</span>
          <strong>${escapeHtml(s.name)}</strong>
          <small>(${escapeHtml(s.city || 'Tibia')})</small>
        </button>
      `).join('');
    } else {
      chipsContainer.style.display = 'none';
      chipsContainer.innerHTML = '';
    }
  }

  // Cambiar a la zona seleccionada
  switchMonsterMapZone(spawnIndex);

  openModal('modal-monster-map');
}
window.openMonsterMapModal = openMonsterMapModal;

function switchMonsterMapZone(spawnIndex) {
  if (!currentMonsterMapSpawns || !currentMonsterMapSpawns[spawnIndex]) return;
  currentMonsterMapIndex = spawnIndex;
  const spawn = currentMonsterMapSpawns[spawnIndex];

  // Actualizar subtítulo
  const subtitleEl = document.getElementById('monster-map-clean-subtitle');
  if (subtitleEl) {
    const coordsStr = spawn.coords ? ` · Piso ${spawn.coords.z} [X: ${spawn.coords.x}, Y: ${spawn.coords.y}]` : '';
    subtitleEl.textContent = `${spawn.name} (${spawn.city || 'Tibia'})${coordsStr}`;
  }

  // Actualizar estado activo en los chips
  const chips = document.querySelectorAll('.monster-clean-chip-btn');
  chips.forEach((c, idx) => {
    if (idx === spawnIndex) c.classList.add('active');
    else c.classList.remove('active');
  });

  // Enlace externo a TibiaMaps
  const linkExternal = document.getElementById('link-external-clean-map');
  if (linkExternal) {
    linkExternal.href = spawn.mapUrl;
  }

  // Cargar iframe del mapa
  const iframe = document.getElementById('monster-map-clean-iframe');
  const loading = document.getElementById('monster-map-clean-loading');
  if (iframe) {
    if (loading) loading.style.display = 'flex';
    iframe.onload = () => {
      if (loading) loading.style.display = 'none';
    };
    iframe.src = spawn.mapUrl;
  }

  // Botón centrar
  const btnRecenter = document.getElementById('btn-recenter-clean-map');
  if (btnRecenter && iframe) {
    btnRecenter.onclick = () => {
      if (loading) loading.style.display = 'flex';
      iframe.src = '';
      setTimeout(() => {
        iframe.src = spawn.mapUrl;
      }, 50);
    };
  }
}
window.switchMonsterMapZone = switchMonsterMapZone;

// Abrir Modal de Ficha Técnica Completa de Monstruo
function openMonsterDetailModal(monsterName) {
  if (!monsterName) return;
  const modal = document.getElementById('modal-monster-detail');
  if (!modal) return;

  const monstersDb = AppState.monsters || (typeof MONSTERS_DATA !== 'undefined' ? MONSTERS_DATA : {});
  const m = monstersDb[monsterName] || {
    name: monsterName,
    hp: '?',
    exp: '?',
    bestiarylevel: 'Medium',
    charm: 25,
    elements: { physical: '100%', earth: '100%', fire: '100%', death: '100%', energy: '100%', holy: '100%', ice: '100%' },
    location: 'Tibia',
    spawns: [],
    loot: []
  };

  const spritesDb = AppState.monsterSprites || (typeof MONSTER_SPRITES_DATA !== 'undefined' ? MONSTER_SPRITES_DATA : {});
  const spriteUrl = m.sprite || spritesDb[monsterName] || `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(monsterName.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

  // Encabezado limpio y sin saturación repetitiva
  const imgEl = document.getElementById('monster-modal-sprite');
  const nameEl = document.getElementById('monster-modal-name');
  const diffEl = document.getElementById('monster-modal-diff-badge');
  const bossBadgeEl = document.getElementById('monster-modal-boss-badge');
  const bosstiaryBadgeEl = document.getElementById('monster-modal-bosstiary-badge');

  if (imgEl) {
    imgEl.src = spriteUrl;
    imgEl.alt = monsterName;
  }
  if (nameEl) nameEl.textContent = monsterName;

  if (m.isBoss) {
    if (diffEl) diffEl.style.display = 'none'; // Los bosses no usan nivel Bestiary/Charm
    if (bossBadgeEl) {
      bossBadgeEl.style.display = 'inline-flex';
      bossBadgeEl.innerHTML = `
        <svg class="boss-red-skull-icon" style="width: 18px; height: 18px; margin-right: 4px;" viewBox="0 0 512 512" aria-hidden="true">
          <path fill="#ff2a2a" d="M416 398.9c58.5-41.1 96-104.1 96-174.9C512 100.3 397.4 0 256 0S0 100.3 0 224c0 70.7 37.5 133.8 96 174.9V448c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32V416h128v32c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32v-49.1zM160 256c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48zm96 72c-13.3 0-24-10.7-24-24 0-8 4-15.3 10.3-19.8l13.7-9.8 13.7 9.8c6.3 4.5 10.3 11.8 10.3 19.8 0 13.3-10.7 24-24 24zm96-72c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48z"/>
        </svg>
        <span>👑 Boss</span>
      `;
    }
    if (bosstiaryBadgeEl) {
      if (m.bosstiaryclass) {
        bosstiaryBadgeEl.style.display = 'inline-flex';
        bosstiaryBadgeEl.className = `bosstiary-tier-pill tier-${m.bosstiaryclass.toLowerCase()}`;
        const icon = m.bosstiaryclass === 'Bane' ? '⚔️' : (m.bosstiaryclass === 'Archfoe' ? '💀' : (m.bosstiaryclass === 'Nemesis' ? '⚡' : '👑'));
        bosstiaryBadgeEl.textContent = `${icon} ${m.bosstiaryclass}`;
      } else {
        bosstiaryBadgeEl.style.display = 'none';
      }
    }
  } else {
    // Monstruo regular
    if (bossBadgeEl) bossBadgeEl.style.display = 'none';
    if (bosstiaryBadgeEl) bosstiaryBadgeEl.style.display = 'none';
    if (diffEl) {
      let diffClass = 'diff-medium';
      const blLower = (m.bestiarylevel || '').toLowerCase();
      if (blLower.includes('harmless') || m.charm === 1) diffClass = 'diff-harmless';
      else if (blLower.includes('easy') || m.charm === 5) diffClass = 'diff-easy';
      else if (blLower.includes('medium') || m.charm === 25) diffClass = 'diff-medium';
      else if (blLower.includes('hard') || m.charm === 50) diffClass = 'diff-hard';
      else if (blLower.includes('challenging') || m.charm === 100) diffClass = 'diff-challenging';

      diffEl.style.display = 'inline-flex';
      diffEl.className = `monster-diff-pill ${diffClass}`;
      diffEl.textContent = m.bestiarylevel || 'Medium';
    }
  }

  // Panel 1: Estadísticas de Combate y Metadata Abajo (Sin duplicados y sin texto recortado)
  const hpEl = document.getElementById('monster-modal-hp');
  const expEl = document.getElementById('monster-modal-exp');
  const boxCharm = document.getElementById('box-stat-charm');
  const charmValEl = document.getElementById('monster-modal-charm-val');
  const boxKills = document.getElementById('box-stat-kills');
  const killsValEl = document.getElementById('monster-modal-stat-kills-val');
  const boxCooldown = document.getElementById('box-stat-cooldown');
  const cooldownValEl = document.getElementById('monster-modal-cooldown-val');
  const boxBosstiary = document.getElementById('box-stat-bosstiary');
  const bosstiaryValEl = document.getElementById('monster-modal-bosstiary-val');

  const hpNum = typeof m.hp === 'number' ? m.hp : parseInt(String(m.hp).replace(/[^0-9]/g, ''), 10);
  const expNum = typeof m.exp === 'number' ? m.exp : parseInt(String(m.exp).replace(/[^0-9]/g, ''), 10);

  if (hpEl) hpEl.textContent = hpNum ? hpNum.toLocaleString() : (m.hp || '?');
  if (expEl) expEl.textContent = expNum ? expNum.toLocaleString() : (m.exp || '?');

  // Charm Points & Kills to Unlock vs Cooldown & Bosstiary (los bosses NO dan charm points ni kills to unlock)
  if (m.isBoss) {
    if (boxCharm) boxCharm.style.display = 'none';
    if (boxKills) boxKills.style.display = 'none';
    if (boxCooldown) {
      boxCooldown.style.display = 'flex';
      if (cooldownValEl) cooldownValEl.textContent = m.cooldown || 'Sin Cooldown';
    }
    if (boxBosstiary) {
      boxBosstiary.style.display = 'flex';
      if (bosstiaryValEl) {
        const icon = m.bosstiaryclass === 'Bane' ? '⚔️' : (m.bosstiaryclass === 'Archfoe' ? '💀' : (m.bosstiaryclass === 'Nemesis' ? '⚡' : '👑'));
        bosstiaryValEl.textContent = m.bosstiaryclass ? `${icon} ${m.bosstiaryclass}` : (m.bossCategory || 'Boss');
      }
    }
  } else {
    if (boxCharm) {
      boxCharm.style.display = 'flex';
      if (charmValEl) charmValEl.textContent = m.charm ? `${m.charm} pts` : '—';
    }
    if (boxKills) {
      boxKills.style.display = 'flex';
      if (killsValEl) killsValEl.textContent = m.killsToUnlock ? m.killsToUnlock.toLocaleString() : (m.kills ? m.kills.toLocaleString() : '1,000');
    }
    if (boxCooldown) boxCooldown.style.display = 'none';
    if (boxBosstiary) boxBosstiary.style.display = 'none';
  }



  // Panel 2: Elementos (Modificadores de Daño) - Ordenados del más débil al más resistente
  const elems = m.elements || {};
  const elementOrderDefault = ['physical', 'fire', 'ice', 'energy', 'earth', 'holy', 'death'];
  const elementsGrid = document.querySelector('.monster-elements-grid');

  const elementData = elementOrderDefault.map(elemKey => {
    const valRaw = elems[elemKey] !== undefined ? elems[elemKey] : '100%';
    const parsed = parseInt(String(valRaw).replace(/[^0-9]/g, ''), 10);
    const num = isNaN(parsed) ? 100 : parsed;
    return {
      key: elemKey,
      num: num,
      cardEl: document.getElementById(`elem-card-${elemKey}`)
    };
  });

  // Ordenar del más débil a la izquierda (mayor daño %, p. ej. 120% Débil) al más resistente a la derecha (menor daño %, p. ej. 0% Inmune)
  elementData.sort((a, b) => {
    if (a.num !== b.num) {
      return b.num - a.num; // Mayor daño primero (izq) -> Menor daño después (der)
    }
    return elementOrderDefault.indexOf(a.key) - elementOrderDefault.indexOf(b.key);
  });

  elementData.forEach((item, index) => {
    const elemKey = item.key;
    const num = item.num;

    const valEl = document.getElementById(`elem-val-${elemKey}`);
    const tagEl = document.getElementById(`elem-tag-${elemKey}`);
    const barEl = document.getElementById(`elem-bar-${elemKey}`);
    const cardEl = item.cardEl;

    if (valEl) valEl.textContent = `${num}%`;

    let tagText = 'Normal';
    let tagClass = 'tag-neutral';

    if (num === 0) {
      tagText = 'Inmune (0%)';
      tagClass = 'tag-immune';
    } else if (num < 100) {
      tagText = `Resiste (-${100 - num}%)`;
      tagClass = 'tag-resist';
    } else if (num > 100) {
      tagText = `Débil (+${num - 100}%)`;
      tagClass = 'tag-weak';
    }

    if (tagEl) {
      tagEl.textContent = tagText;
      tagEl.className = `elem-tag ${tagClass}`;
    }

    if (barEl) {
      const barWidth = num === 0 ? 0 : Math.min(Math.max((num / 200) * 100, 4), 100);
      barEl.style.width = `${barWidth}%`;
    }

    // Acomodar visualmente del más débil (izquierda) al más resistente (derecha)
    if (cardEl) {
      cardEl.style.order = index;
      if (elementsGrid) {
        elementsGrid.appendChild(cardEl);
      }
    }
  });

  // Panel 3: Creature products de Imbuements
  const imbuSection = document.getElementById('monster-imbu-section');
  const imbuChipsContainer = document.getElementById('monster-imbu-chips-container');
  const imbuDrops = m.imbuementDrops || [];

  if (imbuSection && imbuChipsContainer) {
    if (imbuDrops.length === 0) {
      imbuSection.style.display = 'none';
    } else {
      imbuSection.style.display = 'flex';
      imbuChipsContainer.innerHTML = imbuDrops.map(dropName => {
        const dropIcon = (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl)
          ? TibiaScraper.getFandomItemIconUrl(dropName)
          : `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(dropName.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;
        return `
          <div 
            class="monster-imbu-product-chip" 
            onclick="closeModal('modal-monster-detail'); openItemDropsModal('${escapeHtml(dropName)}', '${escapeHtml(dropIcon)}');"
            title="Ver imbuements y detalles de '${escapeHtml(dropName)}'"
          >
            <img 
              src="${escapeHtml(dropIcon)}" 
              alt="${escapeHtml(dropName)}" 
              class="monster-imbu-chip-sprite"
              onerror="this.style.display='none';"
            >
            <strong>${escapeHtml(dropName)}</strong>
            <span style="font-size: 0.72rem; color: var(--gold); margin-left: 0.2rem;">(Ver Drops / NPCs)</span>
          </div>
        `;
      }).join('');
    }
  }

  // Panel 4: Loot de TibiaWiki (Ordenado del más raro al menos raro)
  const lootContainer = document.getElementById('monster-loot-grid');
  const lootCountEl = document.getElementById('monster-loot-count');
  const rawLootList = m.loot || [];

  const getLootRarityWeight = (rarity) => {
    const r = (rarity || '').toLowerCase().trim();
    if (r.includes('extremely rare')) return 60;
    if (r.includes('very rare')) return 50;
    if (r.includes('rare') && !r.includes('semi')) return 40;
    if (r.includes('semi-rare') || r.includes('semirare')) return 30;
    if (r.includes('uncommon')) return 20;
    if (r.includes('common') && !r.includes('uncommon')) return 10;
    if (r === 'always') return 5;
    return 15;
  };

  const lootList = [...rawLootList]
    .filter(it => it && it.item && it.item.trim().toLowerCase() !== 'empty')
    .sort((a, b) => {
      const parsePct = (p) => {
        if (!p) return null;
        const num = parseFloat(String(p).replace(/%/g, ''));
        return isNaN(num) ? null : num;
      };
      const pctA = parsePct(a.percentage);
      const pctB = parsePct(b.percentage);
      // Más raro primero: menor porcentaje primero (ej. 0.065% -> 0.090% -> ... -> 100%)
      if (pctA !== null && pctB !== null && pctA !== pctB) {
        return pctA - pctB;
      }
      // Si alguno no tiene porcentaje numérico, ordenar por peso de rareza (60 extremadamente raro -> 5 always)
      const weightDiff = getLootRarityWeight(b.rarity) - getLootRarityWeight(a.rarity);
      if (weightDiff !== 0) return weightDiff;
      return (a.item || '').localeCompare(b.item || '');
    });

  if (lootCountEl) {
    lootCountEl.textContent = `${lootList.length} items registrados`;
  }

  if (lootContainer) {
    if (lootList.length === 0) {
      lootContainer.innerHTML = `<span style="color: var(--text-dim); font-size: 0.8rem; padding: 0.5rem;">No se encontraron drops directos en el infobox de TibiaWiki.</span>`;
    } else {
      lootContainer.innerHTML = lootList.map(item => {
        const getLootRarityInfo = (rarity, itemName = '', isBoss = false, exactPct = '') => {
          let r = (rarity || '').toLowerCase().trim().replace(/\?/g, '');
          const lowerItem = itemName.toLowerCase();

          // Si viene con porcentaje numérico exacto desde TibiaWiki
          if (exactPct) {
            const num = parseFloat(String(exactPct).replace(/%/g, ''));
            if (!isNaN(num)) {
              if (num >= 99.9 || exactPct.toLowerCase() === 'always') return { name: 'Always', pct: exactPct, cls: 'rarity-always' };
              if (num >= 25.0) return { name: 'Common', pct: exactPct, cls: 'rarity-common' };
              if (num >= 5.0) return { name: 'Uncommon', pct: exactPct, cls: 'rarity-uncommon' };
              if (num >= 1.0) return { name: 'Semi-Rare', pct: exactPct, cls: 'rarity-semi-rare' };
              if (num >= 0.5) return { name: 'Rare', pct: exactPct, cls: 'rarity-rare' };
              if (num >= 0.1) return { name: 'Very Rare', pct: exactPct, cls: 'rarity-very-rare' };
              return { name: 'Extr. Rare', pct: exactPct, cls: 'rarity-extremely-rare' };
            }
          }

          // Monedas estándar siempre tienen frecuencia común (25% - 100%)
          if (!r) {
            if (lowerItem.includes('gold coin') || lowerItem.includes('platinum coin') || lowerItem.includes('crystal coin')) {
              r = 'common';
            }
          }

          if (r === 'always') {
            return { name: 'Always', pct: '100%', cls: 'rarity-always' };
          }
          if (r.includes('extremely rare')) {
            return { name: 'Extr. Rare', pct: '< 0.1%', cls: 'rarity-extremely-rare' };
          }
          if (r.includes('very rare')) {
            return { name: 'Very Rare', pct: '< 0.5%', cls: 'rarity-very-rare' };
          }
          if (r.includes('rare') && !r.includes('semi')) {
            return { name: 'Rare', pct: '0.5% - 1%', cls: 'rarity-rare' };
          }
          if (r.includes('semi-rare') || r.includes('semirare')) {
            return { name: 'Semi-Rare', pct: '1% - 5%', cls: 'rarity-semi-rare' };
          }
          if (r.includes('uncommon')) {
            return { name: 'Uncommon', pct: '5% - 25%', cls: 'rarity-uncommon' };
          }
          if (r.includes('common')) {
            return { name: 'Common', pct: '25% - 100%', cls: 'rarity-common' };
          }

          // Si es un boss y no tiene bracket Bestiary asignado (items legendarios/equipamiento de boss)
          if (isBoss) {
            return { name: 'Boss Drop', pct: 'Variable', cls: 'rarity-boss-drop' };
          }

          // Criaturas comunes sin bracket en infobox (comida, skulls, drops iniciales)
          return { name: 'Common', pct: '> 25%', cls: 'rarity-common' };
        };

        const rarityInfo = getLootRarityInfo(item.rarity, item.item, !!m.isBoss, item.percentage);
        const countText = item.count && item.count !== '1' ? `${item.count}x ` : '';
        const itemIcon = (typeof TibiaScraper !== 'undefined' && TibiaScraper.getFandomItemIconUrl)
          ? TibiaScraper.getFandomItemIconUrl(item.item)
          : `https://static.wikia.nocookie.net/tibia/images/${encodeURIComponent(item.item.replace(/\s+/g, '_'))}.gif/revision/latest?path-prefix=en`;

        const isImbuDrop = (m.imbuementDrops && m.imbuementDrops.includes(item.item)) || 
                           (AppState.creatureDrops && AppState.creatureDrops[item.item]);
        const clickAttr = isImbuDrop 
          ? `onclick="closeModal('modal-monster-detail'); openItemDropsModal('${escapeHtml(item.item)}', '${escapeHtml(itemIcon)}');" style="cursor: pointer;"` 
          : '';

        return `
          <div class="monster-loot-item ${isImbuDrop ? 'is-imbu-drop' : ''}" ${clickAttr} title="${countText}${escapeHtml(item.item)} (${escapeHtml(rarityInfo.name)}: ${escapeHtml(rarityInfo.pct)})${isImbuDrop ? ' - Clic para ver drops e imbuements' : ''}">
            <div class="monster-loot-item-left">
              <div class="monster-loot-sprite-box">
                <img 
                  src="${escapeHtml(itemIcon)}" 
                  alt="${escapeHtml(item.item)}" 
                  class="monster-loot-sprite-img" 
                  loading="lazy" 
                  onerror="this.onerror=null; this.src='https://static.wikia.nocookie.net/tibia/images/4/4a/Site-favicon.ico/revision/latest?path-prefix=en';"
                >
              </div>
              <span class="monster-loot-name">${countText}${escapeHtml(item.item)}</span>
            </div>
            <span class="loot-rarity-badge ${rarityInfo.cls}">
              <span>${escapeHtml(rarityInfo.name)}</span>
              <span class="loot-rarity-pct">${escapeHtml(rarityInfo.pct)}</span>
            </span>
          </div>
        `;
      }).join('');
    }
  }

  // Panel 5: Ubicaciones & Spawns
  const spawnsContainer = document.getElementById('monster-spawns-chips-container');
  const spawnsCountEl = document.getElementById('monster-spawns-count');
  const btnFooterMap = document.getElementById('btn-footer-open-map');

  let spawnsList = (m.spawns && m.spawns.length > 0) ? m.spawns : null;
  const firstSpawnIsThaisFallback = spawnsList && spawnsList.length === 1 && spawnsList[0].name === 'Thais' && m.location && !m.location.toLowerCase().includes('thais');
  if (!spawnsList || firstSpawnIsThaisFallback) {
    spawnsList = resolveSpawnForLocation(m.location);
    m.spawns = spawnsList;
  }

  if (spawnsCountEl) {
    spawnsCountEl.textContent = `${spawnsList.length} zona${spawnsList.length === 1 ? '' : 's'} en el mapa`;
  }

  if (btnFooterMap) {
    btnFooterMap.onclick = () => openMonsterMapModal(monsterName, 0);
  }

  if (spawnsContainer) {
    spawnsContainer.innerHTML = spawnsList.map((s, idx) => `
      <div 
        class="monster-spawn-chip" 
        onclick="openMonsterMapModal('${escapeHtml(monsterName)}', ${idx})" 
        title="Clic para abrir el mapa centrado en ${escapeHtml(s.name)}"
      >
        <span>📍</span>
        <strong>${escapeHtml(s.name)}</strong>
        <span class="monster-spawn-chip-city">(${escapeHtml(s.city || 'Tibia')})</span>
        <span style="font-size: 0.68rem; color: #7dd3fc; margin-left: 0.25rem;">🗺️ Ver</span>
      </div>
    `).join('');
  }

  // Notas descriptivas completas
  const locEl = document.getElementById('monster-modal-locations');
  if (locEl) {
    locEl.textContent = m.location && m.location.trim() ? m.location : 'Ubicación común o dungeons en todo el continente de Tibia.';
  }

  // Footer: Enlace a TibiaWiki
  const wikiLinkEl = document.getElementById('monster-modal-wiki-link');
  if (wikiLinkEl) {
    wikiLinkEl.href = `https://tibia.fandom.com/wiki/${encodeURIComponent(monsterName.replace(/\s+/g, '_'))}`;
    wikiLinkEl.title = `Abrir página oficial de ${monsterName} en TibiaWiki`;
  }

  // Botones de actualización en modal
  const btnDetailSync = document.getElementById('btn-monster-detail-sync');
  if (btnDetailSync) {
    btnDetailSync.onclick = () => quickUpdateSingleMonster(monsterName, btnDetailSync);
  }
  const btnFooterUpdate = document.getElementById('btn-footer-update-monster');
  if (btnFooterUpdate) {
    btnFooterUpdate.onclick = () => quickUpdateSingleMonster(monsterName, btnFooterUpdate);
  }

  openModal('modal-monster-detail');
}
window.openMonsterDetailModal = openMonsterDetailModal;

// ==========================================
// ACTUALIZADOR DE MONSTRUOS Y BOSSES DESDE TIBIAWIKI
// ==========================================
let isMonsterUpdating = false;
let cancelMonsterUpdateRequested = false;

function openMonsterUpdaterModal() {
  const readyStep = document.getElementById('monster-updater-step-ready');
  const runningStep = document.getElementById('monster-updater-step-running');
  const finishedStep = document.getElementById('monster-updater-step-finished');

  if (readyStep) readyStep.style.display = 'block';
  if (runningStep) runningStep.style.display = 'none';
  if (finishedStep) finishedStep.style.display = 'none';

  // Configurar total en el badge y banner
  const totalAllEl = document.getElementById('updater-count-all');
  const countBannerEl = document.getElementById('updater-all-count-banner');
  const countRadioEl = document.getElementById('updater-count-all-radio');
  const countMonstersRadio = document.getElementById('updater-count-monsters-radio');
  const countMonstersBanner = document.getElementById('updater-monsters-count-banner');
  const countBossesRadio = document.getElementById('updater-count-bosses-radio');
  const countBossesBanner = document.getElementById('updater-bosses-count-banner');

  if (AppState.monsters) {
    const allList = Object.values(AppState.monsters);
    const regularCount = allList.filter(m => !m.isBoss).length;
    const bossCount = allList.filter(m => m.isBoss).length;
    const totalCount = allList.length;

    if (totalAllEl) totalAllEl.textContent = totalCount.toLocaleString();
    if (countBannerEl) countBannerEl.textContent = totalCount.toLocaleString();
    if (countRadioEl) countRadioEl.textContent = totalCount.toLocaleString();

    if (countMonstersRadio) countMonstersRadio.textContent = regularCount.toLocaleString();
    if (countMonstersBanner) countMonstersBanner.textContent = regularCount.toLocaleString();
    if (countBossesRadio) countBossesRadio.textContent = bossCount.toLocaleString();
    if (countBossesBanner) countBossesBanner.textContent = bossCount.toLocaleString();
  }



  // Manejar selección de tarjetas de alcance (radio buttons)
  const radioCards = document.querySelectorAll('.scope-card');
  radioCards.forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    if (!radio) return;
    card.onclick = (e) => {
      if (e.target.tagName === 'SELECT' || (e.target.tagName === 'INPUT' && e.target.type !== 'radio')) return;
      radio.checked = true;
      radioCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
    radio.onchange = () => {
      radioCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    };
  });

  openModal('modal-monster-updater');
}
window.openMonsterUpdaterModal = openMonsterUpdaterModal;

async function saveMonstersToServerSilent() {
  try {
    await fetch('/api/save-monsters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(AppState.monsters)
    });
  } catch (e) {}
}

function startRegularMonstersUpdateInstantly() {
  openMonsterUpdaterModal();
  const radio = document.querySelector('input[name="monster-update-scope"][value="monsters"]');
  if (radio) {
    radio.checked = true;
    document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
    document.getElementById('card-scope-monsters')?.classList.add('active');
  }
  setTimeout(() => {
    startMonsterUpdate();
  }, 150);
}
window.startRegularMonstersUpdateInstantly = startRegularMonstersUpdateInstantly;

function startBossesUpdateInstantly() {
  openMonsterUpdaterModal();
  const radio = document.querySelector('input[name="monster-update-scope"][value="bosses"]');
  if (radio) {
    radio.checked = true;
    document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
    document.getElementById('card-scope-bosses')?.classList.add('active');
  }
  setTimeout(() => {
    startMonsterUpdate();
  }, 150);
}
window.startBossesUpdateInstantly = startBossesUpdateInstantly;

function startFullMonsterUpdateInstantly() {
  openMonsterUpdaterModal();
  const radioAll = document.querySelector('input[name="monster-update-scope"][value="all"]');
  if (radioAll) {
    radioAll.checked = true;
    document.querySelectorAll('.scope-card').forEach(c => c.classList.remove('active'));
    document.getElementById('card-scope-all')?.classList.add('active');
  }
  setTimeout(() => {
    startMonsterUpdate();
  }, 150);
}
window.startFullMonsterUpdateInstantly = startFullMonsterUpdateInstantly;

// ==========================================
// REPORTE DE ERRORES PARA MONSTRUOS & BOSSES
// ==========================================
function renderMonsterUpdateErrorReport(failedMonsters, totalProcessed, updatedCount) {
  const errorBox = document.getElementById('mup-errors-report-box');
  const errorsCard = document.getElementById('mup-final-errors-card');
  const errorsCountEl = document.getElementById('mup-final-errors');
  const finishIcon = document.getElementById('mup-finished-icon');
  const finishTitle = document.getElementById('mup-finished-title');
  const finishDesc = document.getElementById('mup-finished-desc');

  if (errorsCard) errorsCard.style.display = failedMonsters.length > 0 ? 'block' : 'none';
  if (errorsCountEl) errorsCountEl.textContent = failedMonsters.length;

  if (failedMonsters.length === 0) {
    if (finishIcon) finishIcon.textContent = '🎉';
    if (finishTitle) finishTitle.textContent = cancelMonsterUpdateRequested ? 'Sincronización Detenida' : '¡Sincronización Completada con Éxito!';
    if (finishDesc) finishDesc.textContent = 'Los datos han sido actualizados y guardados en monsters_data.json y monsters_data.js sin errores.';
    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.innerHTML = '';
    }
    return;
  }

  // Hay criaturas con errores
  if (finishIcon) finishIcon.textContent = '⚠️';
  if (finishTitle) finishTitle.textContent = cancelMonsterUpdateRequested ? 'Sincronización Detenida (con fallos)' : `⚠️ Sincronización Finalizada con Errores (${failedMonsters.length})`;
  if (finishDesc) finishDesc.textContent = `Se procesaron los datos, pero ${failedMonsters.length} criatura(s) no pudieron completarse. Revisa el reporte detallado a continuación:`;

  if (!errorBox) return;
  errorBox.style.display = 'block';

  const itemsHtml = failedMonsters.map((item, idx) => `
    <div class="updater-error-item" id="mup-err-item-${idx}">
      <div class="updater-error-item-left">
        <div class="updater-error-item-avatar">
          ${item.sprite ? `<img src="${item.sprite}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.parentElement.innerHTML='👾';">` : '👾'}
        </div>
        <div class="updater-error-item-info">
          <div class="updater-error-item-name">${escapeHtml(item.name)} <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 400;">(${item.time})</span></div>
          <div class="updater-error-item-msg" title="${escapeHtml(item.error)}">⚠️ ${escapeHtml(item.error)}</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-error-item-retry" data-mup-retry-name="${escapeHtml(item.name)}" data-mup-retry-idx="${idx}">
          🔄 Reintentar
        </button>
      </div>
    </div>
  `).join('');

  errorBox.innerHTML = `
    <div class="updater-error-report-card">
      <div class="updater-error-header">
        <div class="updater-error-title-wrap">
          <span style="font-size: 1.15rem;">📋</span>
          <strong style="color: #f87171; font-size: 0.95rem;">Reporte Detallado de Errores</strong>
          <span class="updater-error-badge-count">${failedMonsters.length} fallos</span>
        </div>
        <div class="updater-error-actions">
          <button type="button" class="btn-error-action btn-error-copy" id="btn-copy-mup-errors-report" title="Copiar reporte al portapapeles">
            📋 Copiar Reporte
          </button>
          <button type="button" class="btn-error-action btn-error-copy" id="btn-export-mup-errors-log" title="Guardar informe como archivo de texto">
            💾 Guardar Log
          </button>
          <button type="button" class="btn-error-action btn-error-retry-all" id="btn-retry-all-mup-errors" title="Reintentar únicamente las criaturas que fallaron">
            🔄 Reintentar Fallidos (${failedMonsters.length})
          </button>
        </div>
      </div>
      <div class="updater-error-list" id="mup-error-items-list">
        ${itemsHtml}
      </div>
    </div>
  `;

  // Asignar listeners
  const btnCopy = document.getElementById('btn-copy-mup-errors-report');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      const summaryText = generateErrorReportSummaryText('Actualización de Monstruos & Bosses', {
        total: totalProcessed,
        successCount: updatedCount,
        errorCount: failedMonsters.length,
        extraInfo: `Actualizados con éxito: ${updatedCount}`,
        failedItems: failedMonsters
      });
      const ok = await copyTextToClipboard(summaryText);
      if (ok) {
        showToast('📋 Reporte de errores de criaturas copiado al portapapeles', 'success');
        btnCopy.textContent = '✓ Copiado';
        setTimeout(() => { btnCopy.textContent = '📋 Copiar Reporte'; }, 2000);
      }
    });
  }

  const btnExport = document.getElementById('btn-export-mup-errors-log');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const summaryText = generateErrorReportSummaryText('Actualización de Monstruos & Bosses', {
        total: totalProcessed,
        successCount: updatedCount,
        errorCount: failedMonsters.length,
        extraInfo: `Actualizados con éxito: ${updatedCount}`,
        failedItems: failedMonsters
      });
      downloadTextAsFile(`reporte_errores_monstruos_${Date.now()}.txt`, summaryText);
      showToast('💾 Archivo de reporte descargado', 'info');
    });
  }

  const btnRetryAll = document.getElementById('btn-retry-all-mup-errors');
  if (btnRetryAll) {
    btnRetryAll.addEventListener('click', () => {
      const failedList = failedMonsters.map(f => f.monster || { name: f.name });
      startMonsterUpdate(failedList);
    });
  }

  // Listeners individuales
  errorBox.querySelectorAll('[data-mup-retry-name]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const name = btn.getAttribute('data-mup-retry-name');
      const idx = btn.getAttribute('data-mup-retry-idx');
      btn.disabled = true;
      btn.textContent = '⏳ ...';
      try {
        await quickUpdateSingleMonster(name, null);
        const itemRow = document.getElementById(`mup-err-item-${idx}`);
        if (itemRow) {
          itemRow.classList.add('is-resolved');
          const msgEl = itemRow.querySelector('.updater-error-item-msg');
          if (msgEl) {
            msgEl.style.color = '#4ade80';
            msgEl.textContent = '✓ Actualizado correctamente';
          }
        }
        btn.textContent = '✓ Listo';
        btn.style.borderColor = '#4ade80';
        btn.style.color = '#4ade80';
        showToast(`✓ Criatura "${name}" sincronizada con éxito`, 'success');
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '🔄 Reintentar';
        showToast(`Error al reintentar "${name}": ${e.message}`, 'error');
      }
    });
  });
}

async function startMonsterUpdate(customTargetList = null) {
  if (isMonsterUpdating) return;
  if (!AppState.monsters) return;

  const allList = Object.values(AppState.monsters);
  let targetMonsters = [];

  if (customTargetList && Array.isArray(customTargetList) && customTargetList.length > 0) {
    targetMonsters = customTargetList;
  } else {
    const scopeRadios = document.querySelectorAll('input[name="monster-update-scope"]');
    let selectedScope = 'class';
    scopeRadios.forEach(r => { if (r.checked) selectedScope = r.value; });

    if (selectedScope === 'monsters' || selectedScope === 'regular') {
      targetMonsters = allList.filter(m => !m.isBoss);
      if (targetMonsters.length === 0) {
        alert('No se encontraron monstruos regulares para actualizar.');
        return;
      }
    } else if (selectedScope === 'bosses') {
      const selectTier = document.getElementById('updater-select-boss-tier');
      const tier = selectTier ? selectTier.value : 'all-bosses';
      if (tier === 'all-bosses') {
        targetMonsters = allList.filter(m => m.isBoss);
      } else if (tier === 'bane') {
        targetMonsters = allList.filter(m => m.isBoss && m.bosstiaryclass === 'Bane');
      } else if (tier === 'archfoe') {
        targetMonsters = allList.filter(m => m.isBoss && m.bosstiaryclass === 'Archfoe');
      } else if (tier === 'nemesis') {
        targetMonsters = allList.filter(m => m.isBoss && m.bosstiaryclass === 'Nemesis');
      } else if (tier === 'cooldown') {
        targetMonsters = allList.filter(m => m.isBoss && !!m.cooldown);
      }
    } else if (selectedScope === 'single') {
      const inputSingle = document.getElementById('updater-input-single');
      const query = inputSingle ? inputSingle.value.trim() : '';
      if (!query) {
        alert('Por favor ingresa el nombre de la criatura o boss a actualizar.');
        if (inputSingle) inputSingle.focus();
        return;
      }
      const found = allList.find(m => m.name.toLowerCase() === query.toLowerCase()) || { name: query };
      targetMonsters = [found];
    } else {
      // Todos en general de golpe
      targetMonsters = allList;
    }
  }

  isMonsterUpdating = true;
  cancelMonsterUpdateRequested = false;

  const readyStep = document.getElementById('monster-updater-step-ready');
  const runningStep = document.getElementById('monster-updater-step-running');
  const finishedStep = document.getElementById('monster-updater-step-finished');

  if (readyStep) readyStep.style.display = 'none';
  if (runningStep) runningStep.style.display = 'flex';
  if (finishedStep) finishedStep.style.display = 'none';

  const btnCancel = document.getElementById('btn-cancel-monster-update');
  if (btnCancel) {
    btnCancel.textContent = '🛑 Detener Sincronización';
    btnCancel.disabled = false;
  }

  const optLoot = document.getElementById('mup-opt-loot')?.checked ?? true;
  const optStats = document.getElementById('mup-opt-stats')?.checked ?? true;
  const optElements = document.getElementById('mup-opt-elements')?.checked ?? true;
  const optLocation = document.getElementById('mup-opt-location')?.checked ?? true;

  const total = targetMonsters.length;
  let processedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  const failedMonsters = [];
  const startTime = Date.now();

  const progressBar = document.getElementById('mup-progress-bar');
  const progressPct = document.getElementById('mup-progress-pct');
  const progressFraction = document.getElementById('mup-progress-fraction');
  const currentAvatar = document.getElementById('mup-current-avatar');
  const currentName = document.getElementById('mup-current-name');
  const currentStatus = document.getElementById('mup-current-status');
  const logBox = document.getElementById('mup-log-box');
  const statProcessed = document.getElementById('mup-stat-processed');
  const statUpdated = document.getElementById('mup-stat-updated');
  const statErrors = document.getElementById('mup-stat-errors');
  const statEta = document.getElementById('mup-stat-eta');

  if (logBox) logBox.innerHTML = '';
  if (progressBar) progressBar.style.width = '0%';
  if (progressPct) progressPct.textContent = '0%';
  if (progressFraction) progressFraction.textContent = `0 / ${total}`;
  if (statProcessed) statProcessed.textContent = '0';
  if (statUpdated) statUpdated.textContent = '0';
  if (statErrors) statErrors.textContent = '0';
  if (statEta) statEta.textContent = `~${Math.round(total * 0.15)}s`;

  function appendLog(text, type = '') {
    if (!logBox) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `batch-log-line ${type}`;
    line.textContent = `[${time}] ${text}`;
    logBox.appendChild(line);
    // Limitar logs a los últimos 200 para evitar fugas de memoria
    if (logBox.children.length > 200) {
      logBox.removeChild(logBox.firstChild);
    }
    logBox.scrollTop = logBox.scrollHeight;
  }

  // Concurrencia paralela optimizada y controlada (3 hilos con pausas para evitar rate limits de Fandom)
  const CONCURRENCY = 3;
  appendLog(`Iniciando sincronización controlada (${CONCURRENCY} hilos) de ${total} criatura(s)...`, 'highlight');

  let nextIndex = 0;

  async function worker(workerId) {
    while (nextIndex < total && !cancelMonsterUpdateRequested) {
      const idx = nextIndex++;
      const item = targetMonsters[idx];
      const name = item.name;

      if (currentName) currentName.textContent = `[${idx + 1}/${total}] ${name}`;
      if (currentStatus) currentStatus.textContent = `Descargando datos oficiales (hilo ${workerId + 1}/${CONCURRENCY})...`;
      if (currentAvatar) {
        const sprite = item.sprite || (AppState.monsterSprites && AppState.monsterSprites[name]) || '';
        if (sprite) {
          currentAvatar.innerHTML = `<img src="${sprite}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='';">`;
        } else {
          currentAvatar.innerHTML = `<span style="font-size: 1.5rem;">👾</span>`;
        }
      }

      try {
        const scraped = await TibiaScraper.scrapeMonster(name);

        // Smart merge con los datos locales
        const existing = AppState.monsters[name] || { name };
        let changed = false;

        if (optStats) {
          if (scraped.hp !== undefined) { existing.hp = scraped.hp; changed = true; }
          if (scraped.exp !== undefined) { existing.exp = scraped.exp; changed = true; }
          if (scraped.bestiarylevel) { existing.bestiarylevel = scraped.bestiarylevel; changed = true; }
          if (scraped.charm !== undefined) { existing.charm = scraped.charm; changed = true; }
          if (scraped.killsToUnlock !== undefined) { existing.killsToUnlock = scraped.killsToUnlock; changed = true; }
          if (scraped.isBoss !== undefined) { existing.isBoss = scraped.isBoss; changed = true; }
          if (scraped.isRaid !== undefined) { existing.isRaid = scraped.isRaid; changed = true; }
          if (scraped.bosstiaryclass) { existing.bosstiaryclass = scraped.bosstiaryclass; changed = true; }
          if (scraped.cooldown) { existing.cooldown = scraped.cooldown; changed = true; }
        }

        if (optLoot && scraped.loot && scraped.loot.length > 0) {
          existing.loot = scraped.loot;
          changed = true;
        }

        if (optElements && scraped.elements && Object.keys(scraped.elements).length > 0) {
          existing.elements = scraped.elements;
          changed = true;
        }

        if (optLocation && scraped.location) {
          existing.location = scraped.location;
          existing.spawns = resolveSpawnForLocation(scraped.location);
          changed = true;
        }

        existing.updatedAt = new Date().toISOString();
        AppState.monsters[name] = existing;

        processedCount++;
        if (changed) {
          updatedCount++;
          if (statUpdated) statUpdated.textContent = updatedCount;
          appendLog(`✓ ${name} actualizado.`, 'success');
        } else {
          appendLog(`- ${name} verificado.`);
        }
      } catch (err) {
        processedCount++;
        errorCount++;
        if (statErrors) statErrors.textContent = errorCount;
        appendLog(`✗ Error en "${name}": ${err.message}`, 'error');
        failedMonsters.push({
          name: name,
          error: err.message || 'Error de conexión o timeout',
          time: new Date().toLocaleTimeString(),
          sprite: item.sprite || (AppState.monsterSprites && AppState.monsterSprites[name]) || '',
          monster: item
        });
      }

      // Actualizar UI
      const pct = Math.round((processedCount / total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressPct) progressPct.textContent = `${pct}%`;
      if (progressFraction) progressFraction.textContent = `${processedCount} / ${total}`;
      if (statProcessed) statProcessed.textContent = processedCount;

      const elapsed = Date.now() - startTime;
      const avgTime = elapsed / Math.max(1, processedCount);
      const rem = total - processedCount;
      const remSec = Math.max(1, Math.round((rem * avgTime) / (1000 * CONCURRENCY)));
      if (statEta) statEta.textContent = rem > 0 ? `~${remSec}s` : 'Listo';

      // Auto-guardado silencioso cada 25 items procesados para persistencia continua
      if (processedCount % 25 === 0) {
        saveMonstersToServerSilent();
      }

      await new Promise(r => setTimeout(r, 20));
    }
  }

  const workerCount = Math.min(CONCURRENCY, total);
  const workers = [];
  for (let w = 0; w < workerCount; w++) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  if (cancelMonsterUpdateRequested) {
    appendLog('Sincronización detenida por el usuario.', 'error');
  }

  // Guardar en monsters_data.json y monsters_data.js vía endpoint backend
  appendLog('Guardando datos sincronizados en el servidor y archivos locales...', 'highlight');
  try {
    const res = await fetch('/api/save-monsters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(AppState.monsters)
    });
    if (res.ok) {
      appendLog('✓ Base de datos local actualizada con éxito.', 'success');
    }
  } catch (saveErr) {
    appendLog(`Nota: Guardado en memoria activa (${saveErr.message}).`);
  }

  isMonsterUpdating = false;

  // Actualizar paso final
  if (runningStep) runningStep.style.display = 'none';
  if (finishedStep) finishedStep.style.display = 'block';

  const finalProcessed = document.getElementById('mup-final-processed');
  const finalUpdated = document.getElementById('mup-final-updated');
  if (finalProcessed) finalProcessed.textContent = processedCount;
  if (finalUpdated) finalUpdated.textContent = updatedCount;

  // Renderizar Reporte de Errores al final de la actualización si hubo fallos
  renderMonsterUpdateErrorReport(failedMonsters, processedCount, updatedCount);

  if (failedMonsters.length > 0) {
    showToast(`⚠️ Sincronización finalizada con ${failedMonsters.length} error(es). Revisa el reporte.`, 'warning', 4500);
  } else {
    showToast('✓ Sincronización de monstruos completada con éxito sin errores.', 'success');
  }

  renderMonsters();
}
window.startMonsterUpdate = startMonsterUpdate;

// ==========================================
// ACTUALIZACIÓN RÁPIDA DE UN MONSTRUO O BOSS INDIVIDUAL
// ==========================================
async function quickUpdateSingleMonster(monsterName, btnEl) {
  if (!monsterName) return;
  if (btnEl) {
    if (btnEl.classList.contains('is-updating')) return;
    btnEl.classList.add('is-updating');
    btnEl.disabled = true;
  }

  showToast(`Sincronizando ${monsterName} desde TibiaWiki...`, 'info', 2500);

  try {
    const scraped = await TibiaScraper.scrapeMonster(monsterName);
    if (!scraped || !scraped.name) {
      throw new Error('No se obtuvieron datos de TibiaWiki');
    }

    if (!AppState.monsters) AppState.monsters = {};
    const existing = AppState.monsters[monsterName] || { name: monsterName };

    if (scraped.hp != null && scraped.hp !== '?') existing.hp = scraped.hp;
    if (scraped.exp != null && scraped.exp !== '?') existing.exp = scraped.exp;
    if (scraped.charm != null) existing.charm = scraped.charm;
    if (scraped.killsToUnlock !== undefined) existing.killsToUnlock = scraped.killsToUnlock;
    if (scraped.bestiarylevel) existing.bestiarylevel = scraped.bestiarylevel;
    if (scraped.isBoss != null) existing.isBoss = scraped.isBoss;
    if (scraped.isRaid != null) existing.isRaid = scraped.isRaid;
    if (scraped.bosstiaryclass) existing.bosstiaryclass = scraped.bosstiaryclass;
    if (scraped.cooldown) existing.cooldown = scraped.cooldown;
    if (scraped.loot && scraped.loot.length > 0) existing.loot = scraped.loot;
    if (scraped.elements && Object.keys(scraped.elements).length > 0) existing.elements = scraped.elements;
    if (scraped.location) {
      existing.location = scraped.location;
      existing.spawns = resolveSpawnForLocation(scraped.location);
    }
    if (scraped.sprite && !existing.sprite) existing.sprite = scraped.sprite;
    existing.updatedAt = new Date().toISOString();

    AppState.monsters[monsterName] = existing;

    try {
      await fetch('/api/save-monsters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(AppState.monsters)
      });
    } catch (saveErr) {
      console.warn('Guardado en backend:', saveErr);
    }

    showToast(`✓ ${monsterName} actualizado con éxito desde TibiaWiki`, 'success', 3500);

    // Refrescar tarjetas
    renderMonsters();

    // Si el modal de detalle de esta criatura está abierto, refrescarlo
    const modalDetail = document.getElementById('modal-monster-detail');
    if (modalDetail && modalDetail.classList.contains('active')) {
      const currentNameEl = document.getElementById('monster-modal-name');
      if (currentNameEl && currentNameEl.textContent === monsterName) {
        openMonsterDetailModal(monsterName);
      }
    }
  } catch (err) {
    console.error('Error al actualizar criatura:', err);
    showToast(`✗ Error al actualizar ${monsterName}: ${err.message}`, 'error', 4500);
  } finally {
    if (btnEl) {
      btnEl.classList.remove('is-updating');
      btnEl.disabled = false;
    }
  }
}
window.quickUpdateSingleMonster = quickUpdateSingleMonster;

