# Traspaso — Eject Device

Documento de trabajo para continuar en local. **Bórralo antes de publicar al store**;
no forma parte de la extensión.

---

## 1. Qué es

Extensión de Raycast para expulsar iPhone/iPad, discos externos, imágenes de disco
(`.dmg`) y recursos de red desde el teclado, sin abrir Finder.

Vive en `extensions/eject-device/` dentro de un fork de `raycast/extensions`.
Rama de trabajo: `claude/raycast-device-eject-extension-5wyskn`.

⚠️ `package.json` tiene `"author": "gersonsebastianx"` — es una suposición.
Cámbialo por tu handle real de Raycast; el store lo valida.

---

## 2. La idea central

Dos fuentes que ven mitades distintas del problema:

| Elemento               | Detección                               | Expulsión          | ¿Permisos? |
| ---------------------- | --------------------------------------- | ------------------ | ---------- |
| iPhone, iPad, iPod     | Barra lateral de Finder (accesibilidad) | Botón ⏏ de la fila | Sí, dos    |
| Disco, USB, SD         | `diskutil info -plist`                  | `diskutil eject`   | No         |
| Imagen de disco `.dmg` | `diskutil` (bus `Disk Image`)           | `diskutil eject`   | No         |
| Recurso de red         | `mount`                                 | `diskutil unmount` | No         |

**Por qué un iPhone no es un volumen:** no se monta en `/Volumes`, no sale en
`diskutil list`, y Finder no lo expone como `disk` en AppleScript. Habla con él por
su propio protocolo y lo dibuja en la barra lateral. De ahí todo el UI scripting.

---

## 3. Mapa de archivos

```
src/
  eject-device.tsx        Vista principal: secciones, panel de detalle, acciones
  eject-all-disks.ts      Comando masivo (no toca dispositivos), con confirmación
  diagnose-sidebar.tsx    Informe de diagnóstico copiable — tu mejor herramienta
  lib/
    types.ts              Ejectable, VolumeInfo, UsbDevice, SidebarStatus
    applescript.ts        Ejecuta osascript, clasifica errores de permisos
    sidebar.ts            Lee la barra lateral, expulsa, sonda de botones
    volumes.ts            diskutil + montajes de red
    usb.ts                system_profiler (OJO: ver §5, no funciona en este Mac)
    items.ts              Fusiona ambas fuentes en una lista
assets/
  list-sidebar-items.applescript     Lista filas y si son expulsables
  eject-sidebar-item.applescript     Expulsa una fila por nombre (3 estrategias)
  probe-sidebar-buttons.applescript  Vuelca los botones de cada fila
  dump-sidebar.applescript           Vuelca el árbol de accesibilidad
```

---

## 4. Estado real: qué está probado y qué no

### Verificado en el Mac del usuario ✅

- Detecta iPad y iPhone en la barra lateral, con iconos distintos
- Detecta imágenes de disco (`Upscayl`, 980 MB; `Aside Browser`, 1.3 GB)
- Filtra correctamente Escritorio/Documentos (carpetas de iCloud)
- Clasifica el permiso que falta y abre el panel correcto de Ajustes
- **Expulsó un iPad correctamente** (una vez, en v6, al segundo intento)

### Nunca probado ❌

- **Expulsar un disco o imagen de disco con `diskutil`** — el camino más simple
  de toda la extensión y no se ha ejecutado ni una vez. Pruébalo primero.
- El comando **Eject All Disks**
- Recursos de red (no había NAS a mano)
- El **panel de detalle** (`⌘⇧D`) — nunca se abrió
- Todo lo añadido en v11

---

## 5. Hechos de macOS aprendidos a base de golpes

Esto es lo caro de la sesión. No lo re-derives.

**El botón de expulsar se distingue por tener título.** Las filas de iCloud
(Escritorio, Documentos) llevan un botón de sincronización. Contar botones no
sirve. Datos reales del Mac del usuario:

```
[1] Escritorio                botones=1  {desc=botón   |title=        }
[1] iPad de Gerson            botones=1  {desc=expulsar|title=Expulsar}
[1] Upscayl 2.15.0-universal  botones=1  {desc=expulsar|title=Expulsar}
```

Se comprueba que el título **exista**, nunca qué dice: buscar "eject" rompería la
extensión en todo Mac que no esté en inglés.

**Los códigos de error de permisos, no los mensajes.** macOS los traduce.

- `-1743` → Automatización (Apple Events)
- `-1719` **y** `-25211` → Accesibilidad. Los dos aparecen en la práctica.

**`system_profiler SPUSBDataType` no ve los dispositivos iOS de este Mac.**
Devolvió vacío con iPad y con iPhone conectados por cable. `src/lib/usb.ts`
existe pero es inútil aquí. Si necesitas detección USB, investiga `ioreg`.

**Finder solo dibuja la flecha ⏏ en la fila seleccionada o bajo el cursor.**
`click` sintetiza una pulsación en una posición: sobre una fila no seleccionada
cae en el vacío y _reporta éxito igual que un clic que funcionó_. Por eso se usa
`perform action "AXPress"`, que no depende del dibujado.

**Una ventana de Finder recién creada no sirve al instante.** Su barra lateral
tarda un momento. Todos los scripts sondean hasta encontrar una con filas.

**La barra lateral solo existe dentro de una ventana.** No hay forma de leerla
sin una. Si el usuario no tiene ninguna abierta, la extensión abre y cierra una,
y eso se ve. Mitigación práctica: tener una ventana de Finder abierta.

**Node tapa el error real.** `execFile` empieza el mensaje con `Command failed:` y
la línea de comando entera, que en un toast desplaza el motivo fuera de pantalla.
`readableScriptError()` en `applescript.ts` extrae el `stderr` limpio conservando
el código numérico.

---

## 6. El bug abierto

Expulsar el **iPhone** falla. Las tres estrategias dicen haber actuado y la fila
nunca se va. Último mensaje: `Finder would not let go of "iPhone de Gerson"`.

### Prueba decisiva, hazla antes de tocar código

Pulsa **tú mismo** la flecha ⏏ del iPhone en Finder:

| Resultado                                 | Conclusión                                   |
| ----------------------------------------- | -------------------------------------------- |
| No se expulsa                             | No es el código. Finder tampoco puede.       |
| Se expulsa y **reaparece** a los segundos | Wi-Fi (ver abajo). Ningún código lo arregla. |
| Se expulsa y se queda fuera               | Es el código. Sigue con las hipótesis.       |

### Hipótesis, por probabilidad

1. **El dispositivo está en el sidebar por Wi-Fi, no por el cable.** Es la
   principal, y la apoya que `SPUSBDataType` salga vacío. Si Finder lo muestra por
   _"Mostrar este iPhone cuando esté en Wi-Fi"_, expulsarlo no se sostiene: Finder
   lo vuelve a añadir. **v11 detecta este caso** y lo dice con esas palabras —
   distingue "nunca se fue" de "se fue y volvió".
2. **Referencias muertas** rompían el escalado (corregido en v11: busca la fila de
   nuevo en cada intento).
3. **El fallback de ⌘E mentía**, reportaba éxito sin que Finder estuviera al frente
   (corregido en v11).
4. **Dispositivo ocupado** sincronizando. Normalmente saldría un diálogo.

### Si hay que seguir

Ideas sin explorar: leer `AXURL`/`AXSubrole` de la fila; usar el menú Archivo de
Finder por posición en vez de ⌘E; comprobar si aparece una hoja de diálogo en la
ventana de Finder que bloquee la expulsión.

---

## 7. Cómo trabajar

```bash
npm install
npm run dev        # ray develop: se queda corriendo y recarga al guardar
```

Antes de dar nada por bueno:

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npx prettier --check "src/**/*.{ts,tsx}" "*.md"
npx ray build -e dist    # valida el manifiesto contra el esquema del store
```

**El comando `Diagnose Finder Sidebar` es la herramienta clave.** Da el informe
completo con botón de copiar: filas, botones con sus títulos, volúmenes, USB y
árbol de accesibilidad. Cuando algo no se detecte, empieza por ahí.

---

## 8. Cosas que hicieron perder tiempo

- **Los heredocs en Terminal** se rompen al pegar: la última línea llega sin salto
  y zsh se queda esperando en `>`. Mejor scripts en archivo.
- **La descarga desde el chat se come los guiones** del nombre: `eject-device-v4`
  llegaba como `ejectdevicev4`.
- **Doble clic en un `.tar.gz`** extrae en una carpeta _nueva_ (`eject-device 2`),
  no encima. Usa `tar xzf` para actualizar la carpeta que vigila `ray develop`.
