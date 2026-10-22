# ⚔️ Tibia NPC Tracker & Scraper (Programa de Escritorio)

Programa de escritorio para Windows para rastrear, registrar y raspar NPCs de Tibia, sus items de compra/venta y su ubicación en el mapa.

Todos los datos se guardan **físicamente en el archivo `npcs_data.json` dentro de esta misma carpeta del programa**.

---

## 🖥️ Cómo Abrir el Programa en tu PC

Puedes iniciar el programa de dos formas inmediatas:

1. **Doble Clic en `INICIAR_PROGRAMA.vbs`** (Recomendado):
   - Abre la ventana del programa directamente en tu pantalla de forma limpia sin abrir consolas negras.
2. **Doble Clic en `ABRIR_TIBIA_TRACKER.bat`**:
   - Inicia el programa a través del archivo por lotes.
3. **Desde la terminal (si lo prefieres)**:
   ```bash
   npm start
   ```

---

## 📁 Dónde y Cómo se Guardan los Datos

- **Archivo de datos:** `npcs_data.json` (ubicado en esta misma carpeta).
- Cada vez que agregues, edites, raspes o elimines un NPC, se guarda automáticamente en `npcs_data.json`.
- El archivo inicia **vacío (`[]`)** para que comiences a registrar tus propios datos desde cero.

---

## 🌟 Funciones del Programa

1. **🕷️ Extractor Web (Scraper) Integrado**:
   - Introduce la URL de Tibia Wiki (ej. `https://tibia.fandom.com/wiki/Frodo`) o solo el nombre del NPC (ej: `Rashid`, `Frodo`, `Sam`).
   - El programa descarga directamente los datos sin problemas de CORS ni restricciones de navegador.
   - Extrae: Nombre, Ciudad, Profesión, Coordenadas, Sprite/Imagen, Items que vende con precio en `gp` e Items que compra con precio en `gp`.
   - Permite previsualizar antes de guardar.

2. **📍 Ubicación y Mapa**:
   - Muestra las coordenadas exactas (`X`, `Y`, `Piso Z`).
   - Botón *"Ver en Mapa Interactivo"* dentro de la aplicación.
   - Botón *"TibiaMaps.io ↗"* que abre tu navegador con el mapa oficial.

3. **💰 Lista de Items que Compra y Vende**:
   - Pestañas *"Lo que Vende"* y *"Lo que Compra"*.
   - Precios claros en monedas de oro (`gp`).
   - Filtro de búsqueda en tiempo real dentro de los items del NPC.
   - Botón para ordenar por precio.

4. **🔍 Buscador con Autocompletado y Sugerencias en Vivo (con Sprites)**:
   - Al escribir en el buscador, se despliega una lista interactiva de sugerencias en tiempo real.
   - Muestra el **sprite oficial** de cada item o NPC para identificarlo al instante.
   - Conforme escribes, descarta automáticamente las opciones que dejan de coincidir.
   - Indica precios máximos de compra y cuántos NPCs lo comercian.
   - Permite seleccionar con clic o navegar cómodamente con el teclado (flechas Arriba/Abajo y Enter).

5. **🖼️ Selector de Fondos de Pantalla (Wallpapers)**:
   - Botón *"Fondos"* en la barra superior.
   - Permite elegir entre las distintas auroras boreales, picos glaciares, atardecer rosa o el barco pesquero en lago nevado.
   - La selección se aplica en tiempo real y se guarda automáticamente para sesiones futuras.

6. **🐪 Itinerario Semanal Dinámico de Rashid**:
   - Detección automática de la ciudad y taberna donde se encuentra Rashid hoy según el Server Save de Tibia (10:00 CET).
   - Selector interactivo de días (Lunes a Domingo) en su ficha para consultar de inmediato sus próximas ubicaciones, coordenadas exactas y enlaces al mapa oficial.

7. **🚢 Detector en Vivo de Yasir (Hakai Market)**:
   - Consulta automáticamente [Hakai Market](https://hakaimarket.com/) para saber si Yasir ha llegado a tu servidor (**Solidera** por defecto).
   - Widget con píldora en la cabecera con estado en tiempo real (`¡ACTIVO!`, `Ausente` o `Comprobando`).
   - Si no está activo en Solidera hoy, se muestra ausente y no interfiere con las búsquedas de las ciudades portuarias para evitar confusiones.
   - Si está activo, permite alternar entre sus 3 puertos posibles (**Carlin**, **Ankrahmun**, **Liberty Bay**) actualizando de inmediato sus coordenadas y mapas interactivos.
   - Posibilidad de cambiar de servidor objetivo y botones de anulación manual (*Auto*, *Activo*, *Inactivo*).
