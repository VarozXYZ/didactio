# Plan detallado: migracion de contenido de modulos de Markdown a HTML

## 1. Objetivo

Migrar el cuerpo generado de los modulos didacticos desde Markdown a HTML sanitizado, manteniendo una experiencia consistente entre:

- generacion inicial con streaming;
- reapertura del modulo ya generado;
- edicion manual;
- paginacion;
- medicion de progreso de lectura;
- revisiones;
- regeneracion de modulos legacy.

La migracion aplica al contenido principal del modulo. Los textos de planificacion, syllabus, summaries y overviews que ya funcionan en Markdown no cambian su generacion ni su persistencia, pero dentro del lector se renderizan mediante una ruta HTML sanitizada para evitar mezclar pipelines visuales.

## 2. Decisiones cerradas

### Contrato publico de API

Se mantiene el campo publico `content` para minimizar cambios en frontend, pero se anade un discriminador:

```ts
content: string | null;
contentFormat: "html" | "markdown";
```

Reglas:

- `contentFormat: "html"` significa que `content` contiene HTML sanitizado.
- `contentFormat: "markdown"` significa contenido antiguo legacy que no se renderiza como modulo normal.
- Si un capitulo antiguo no tiene `contentFormat` pero si tiene `markdown`, se trata como legacy Markdown.

### Fuente de verdad del contenido

El HTML sanitizado es la fuente de verdad del contenido actual.

Los bloques HTML son cache derivado, no una segunda fuente de verdad:

```ts
contentFormat: "html";
html: string;
htmlHash: string;
htmlBlocks: HtmlContentBlock[];
htmlBlocksVersion: number;
```

`htmlBlocks` se recalcula:

- al generar con IA;
- al regenerar con IA;
- al guardar una edicion manual;
- al abrir un modulo si `htmlHash` o `htmlBlocksVersion` no coinciden.

`htmlBlocks` no se recalcula:

- en cada pulsacion;
- durante preview local del editor;
- en cada render del navegador.

### Legacy Markdown

No se soporta render normal de modulos legacy Markdown.

UX definida:

- mostrar placeholder claro por modulo;
- ocultar/bloquear editor de contenido;
- mostrar boton de regeneracion manual;
- mostrar coste visible antes de regenerar;
- sin accion bulk para regenerar toda una unidad.

Las revisiones Markdown antiguas se conservan visibles como historial, pero la accion de restaurar queda deshabilitada.

### Sanitizacion

Crear un workspace comun `shared` usado por backend y frontend para evitar divergencias.

El paquete compartido debe contener:

- allow-list canonica de tags y atributos;
- sanitizador;
- normalizacion/reparacion basica de HTML;
- extraccion de texto plano desde HTML;
- derivacion de `htmlBlocks`;
- calculo de `htmlHash`;
- version actual de bloques.

La configuracion de despliegue debe asumir npm workspaces. Los builds de frontend/backend deben instalar dependencias desde la raiz o con soporte workspace-aware.

### Allow-list HTML

Tags de bloque:

- `h2`, `h3`, `h4`;
- `p`;
- `ul`, `ol`, `li`;
- `blockquote`;
- `pre`, `code`;
- `table`, `thead`, `tbody`, `tr`, `th`, `td`;
- `hr`;
- `br`.

Tags inline:

- `strong`;
- `em`;
- `code`;
- `a`;
- `sub`;
- `sup`;
- `mark`.

Atributos permitidos:

- `a`: `href`, `title`;
- `code` y `pre`: `class` solo si empieza por `language-`;
- `th`: `scope`, `colspan`, `rowspan`;
- `td`: `colspan`, `rowspan`.

Normalizacion de enlaces:

- permitir `http://`, `https://`, `mailto:` y anchors `#...`;
- eliminar `javascript:`, `data:` y protocolos no permitidos;
- anadir `rel="noopener noreferrer"` y `target="_blank"` en enlaces externos.

Excluido explicitamente:

- `div`, `section`, `article`;
- `span`;
- `h1`, `h5`, `h6` como salida final;
- `img`;
- `u`;
- `style`, `script`, `iframe`, `form`;
- atributos `style`, eventos `on*` y clases arbitrarias;
- `details`, `summary`.

Reparaciones:

- degradar `h1` a `h2`;
- degradar `h5`/`h6` a `h4`;
- eliminar atributos no permitidos;
- reparar estructuras obvias de tabla cuando sea seguro;
- rechazar contenido vacio tras sanitizar.

### Prompt y pedagogia

El prompt de modulo deja de pedir Markdown y pasa a pedir HTML.

Se reduce el contrato pedagogico a 6 componentes:

- explicacion conceptual;
- ejemplo realista;
- analisis contrastivo entre enfoque efectivo y no efectivo;
- errores comunes;
- actividad de reflexion;
- seccion final de recap visible.

Se eliminan:

- quiz fijo de 3 preguntas;
- meta-conexion separada al siguiente modulo.

Se mantienen:

- balance aproximado 70/30 entre concepto y aplicacion;
- headings en sentence case;
- prohibicion de incluir el titulo del modulo como `h1`;
- salida sin JSON, sin Markdown, sin comentarios y sin code fences envolviendo todo.

### Continuity summary

La continuidad entre modulos se obtiene desde la seccion final visible del modulo.

Decision:

- el prompt exige que el ultimo `h2` sea un heading fijo traducido segun idioma;
- el normalizer valida/localiza esa seccion;
- se extrae su `textContent`;
- ese texto plano se usa como contexto para el siguiente modulo.

No se reinyecta HTML como continuity summary para evitar contaminar el prompt siguiente con markup.

### Streaming

El backend emite bloques HTML semanticos completos, no chunks arbitrarios de texto.

Granularidad de bloque:

- `h2`, `h3`, `h4`;
- `p`;
- `blockquote`;
- listas completas o items agrupados de forma estable;
- `table`;
- `pre/code`;
- `hr`.

El frontend:

- recibe bloques completos;
- no reparsea todo el documento acumulado en cada flush;
- simula generacion progresiva con animacion ligera propia;
- no usa `typeit-react` por defecto por licencia/rendimiento y porque no resuelve por si mismo la carga de HTML largo.

El render streaming y el render al reabrir deben usar la misma representacion derivada del HTML canonico para evitar diferencias visuales.

### Paginacion

La paginacion deja de operar sobre Markdown y pasa a operar sobre HTML sanitizado/bloques derivados.

Politica de particion:

- parrafos y list items: se pueden partir por caracteres de `textContent`, clonando nodos inline abiertos;
- listas: se parten por item y se reconstruye la jerarquia `ul`/`ol`;
- tablas: se parten por filas y se repite `thead` en paginas siguientes;
- codigo: se parte por lineas;
- headings: no se parten;
- `hr`: bloque indivisible;
- headings huerfanos al final de pagina se empujan a la siguiente pagina.

El progreso de lectura se mide por caracteres de `textContent` post-sanitizacion, no por offset sobre HTML serializado.

### Summaries, overviews y syllabus

No se cambia como se generan ni como se guardan.

Siguen pudiendo estar en Markdown porque esa parte ya funciona.

Pero en el lector:

- se convierten a HTML sanitizado mediante un bridge controlado;
- se renderizan y miden por la misma ruta visual HTML que el cuerpo del modulo;
- se evita mezclar visualmente contenido Markdown y contenido HTML en la pagina.

### Editor Lexical

Renombrar conceptualmente `LexicalMarkdownEditor` a editor HTML.

Cambios:

- eliminar `MarkdownShortcutPlugin`;
- eliminar dependencia directa de transformacion Markdown para el editor de modulos;
- inicializar Lexical desde HTML sanitizado;
- serializar Lexical a HTML;
- sanitizar antes de emitir/guardar;
- mantener el HTML sanitizado como valor canonico.

Toolbar:

- quitar color, porque genera `span`/`style`;
- quitar underline, porque `u` no esta permitido;
- quitar H1, porque el titulo lo gestiona la UI y no el cuerpo;
- anadir H4 si el editor lo expone;
- mantener bold, italic, link, listas, code block, headings permitidos, undo/redo.

Atajos:

- conservar atajos nativos como Ctrl+B y Ctrl+I;
- no conservar atajos Markdown tipo `##`, `**`, etc. como dependencia explicita.

### Estilos

Completar estilos v1 en:

- `frontend/src/index.css`;
- `frontend/src/dashboard/utils/typography.ts`;
- medicion DOM en `frontend/src/dashboard/pageLayout.ts`;
- clases `.prose` y `.typography-scope`;
- render del editor Lexical.

Tags que deben tener estilo y medicion coherente:

- `h2`, `h3`, `h4`;
- `p`;
- `a`;
- `strong`, `em`;
- `mark`;
- `sub`, `sup`;
- `blockquote`;
- `ul`, `ol`, `li`;
- `table`, `thead`, `tbody`, `tr`, `th`, `td`;
- `pre`, `code`;
- `hr`;
- `br`.

La medicion y el render visual deben usar los mismos tamanos, margenes, fuentes y line-height para que la paginacion sea estable.

### Coins y fallos

Politica:

- si el HTML generado queda vacio o invalido tras sanitizacion, se reintenta automaticamente una vez sin cobrar de nuevo;
- si el segundo intento falla, se hace refund usando la transaccion original y se muestra error;
- el reintento no crea una segunda transaccion de credito;
- la regeneracion manual de legacy Markdown consume el coste normal visible para el usuario.

## 3. Cambios por subsistema

### Backend: tipos y persistencia

Actualizar `backend/src/didactic-unit/didactic-unit-chapter.ts`.

Nuevo modelo conceptual:

```ts
export type DidacticUnitChapterContentFormat = "markdown" | "html";

export interface HtmlContentBlock {
	id: string;
	type:
		| "heading"
		| "paragraph"
		| "blockquote"
		| "list"
		| "table"
		| "code"
		| "divider";
	html: string;
	textLength: number;
	textStartOffset: number;
	textEndOffset: number;
}

export interface DidacticUnitGeneratedChapter {
	chapterIndex: number;
	title: string;
	contentFormat: DidacticUnitChapterContentFormat;
	markdown?: string;
	html?: string;
	htmlHash?: string;
	htmlBlocks?: HtmlContentBlock[];
	htmlBlocksVersion?: number;
	presentationSettings?: DidacticUnitChapterPresentationSettings;
	generatedAt: string;
	updatedAt?: string;
}
```

Compatibilidad:

- si `contentFormat` falta y existe `markdown`, tratar como `"markdown"`;
- nuevas generaciones escriben `"html"`;
- revisiones deben copiar `contentFormat` y el contenido correspondiente.

### Backend: respuestas API

Actualizar `buildDidacticUnitModuleDetailResponse` en `backend/src/app.ts`.

Debe responder:

```ts
{
	chapterIndex,
	title,
	planningOverview,
	content,
	contentFormat,
	htmlBlocks,
	htmlHash,
	htmlBlocksVersion,
	presentationSettings,
	...
}
```

Reglas:

- para HTML: `content = generatedChapter.html`;
- para Markdown legacy: `content = generatedChapter.markdown`, `contentFormat = "markdown"`;
- si HTML existe pero bloques faltan o estan obsoletos, recalcular de forma lazy y persistir antes o despues de responder segun convenga.

### Backend: generacion IA

Actualizar `backend/src/ai/prompt-builders.ts`.

- `buildChapterMarkdownPrompt` pasa a `buildChapterHtmlPrompt`.
- El output contract lista exactamente tags permitidos.
- Prohibir Markdown y JSON.
- Exigir seccion final de recap con heading fijo traducido.
- Mantener authoring config, idioma, tono y nivel.

Actualizar `backend/src/ai/service.ts`.

- Acumular output bruto como HTML raw.
- Sanitizar y normalizar al final.
- Derivar `htmlHash` y `htmlBlocks`.
- Extraer recap text.
- Emitir bloques HTML completos durante streaming.
- Registrar raw output y sanitized output en generation runs si se anade ese campo.

### Backend: streaming NDJSON

Actualizar `backend/src/ai/ndjson.ts` y `frontend/src/dashboard/api/dashboardApi.ts`.

Evento propuesto:

```ts
type NdjsonEvent =
	| {type: "start"; stage: string; provider: string; model: string}
	| {type: "partial_html_block"; block: HtmlContentBlock}
	| {type: "partial_structured"; data: unknown}
	| {type: "complete"; data: unknown}
	| {type: "error"; message: string; data?: unknown};
```

No emitir `partial_markdown` para modulos HTML.

Puede mantenerse `partial_markdown` temporalmente solo para rutas antiguas si todavia hay tests o flujos legacy que lo necesiten, pero la generacion nueva debe usar `partial_html_block`.

### Backend: continuidad

Eliminar la llamada separada de continuity summary para capitulos HTML.

Mantener `buildLearnerSummaryPrompt` si se usa para otro UX.

Para continuidad entre modulos:

- usar el recap extraido del HTML generado;
- convertirlo a texto plano;
- pasarlo como contexto del siguiente modulo.

### Backend: progreso de lectura

Actualizar `backend/src/didactic-unit/module-reading-progress.ts`.

La funcion equivalente a `getModuleTotalCharacterCount` debe:

- si `contentFormat === "html"`: contar caracteres de texto plano desde HTML sanitizado;
- si legacy Markdown: usar la ruta antigua solo para calcular/mostrar estado si se decide conservar, pero el modulo no se renderiza como contenido normal.

Al regenerar un modulo legacy:

- resetear progreso de lectura de ese modulo;
- recalcular total basado en HTML.

### Backend: edicion manual

Actualizar `backend/src/didactic-unit/update-didactic-unit-chapter.ts` y parsing de input.

Reglas:

- aceptar `contentFormat: "html"` o inferir HTML para capitulos nuevos;
- sanitizar siempre en backend;
- rechazar contenido vacio tras sanitizar;
- recalcular `htmlHash` y `htmlBlocks` solo al guardar;
- crear revision con `contentFormat: "html"`;
- no aceptar updates Markdown sobre capitulos HTML.

### Frontend: tipos y adapters

Actualizar `frontend/src/dashboard/api/dashboardApi.ts`.

Anadir:

```ts
contentFormat: "html" | "markdown";
htmlBlocks?: HtmlContentBlock[];
htmlHash?: string;
htmlBlocksVersion?: number;
```

Actualizar `frontend/src/dashboard/types.ts`.

`DidacticUnitEditorChapter` debe incluir:

```ts
contentFormat: "html" | "markdown";
content: string | null;
htmlBlocks?: HtmlContentBlock[];
```

Actualizar `frontend/src/dashboard/adapters.ts`.

- No llamar `normalizeStoredMarkdown` sobre contenido HTML.
- Calcular reading time desde texto plano HTML si `contentFormat === "html"`.
- Para summaries/overview, mantener valor textual original y renderizar despues mediante bridge.

### Frontend: render legacy

En `UnitEditor.tsx`:

- si `activeChapter.contentFormat === "markdown"`:
  - mostrar placeholder;
  - explicar que el modulo usa formato antiguo;
  - mostrar boton de regeneracion con coste;
  - bloquear editor;
  - no intentar paginar como HTML;
  - no renderizar Markdown crudo como contenido final.

Revisions:

- si revision `contentFormat === "markdown"`:
  - visible en historial;
  - boton restore disabled;
  - tooltip/mensaje indicando que debe regenerarse en HTML.

### Frontend: editor HTML

Crear/renombrar `LexicalHtmlEditor`.

Responsabilidades:

- recibir `initialHtml`;
- sanitizar antes de inicializar si hace falta;
- parsear HTML a DOM;
- generar nodos Lexical desde DOM;
- serializar Lexical a HTML;
- sanitizar antes de `onHtmlChange`;
- no depender de Markdown round-trip.

Eliminar de este flujo:

- `MarkdownShortcutPlugin`;
- `TRANSFORMERS`;
- conversion `htmlToStoredMarkdown`;
- conversion Markdown -> DOM para el contenido del modulo HTML.

### Frontend: streaming por bloques

En `UnitEditor.tsx`:

- sustituir buffer de Markdown acumulado por lista de bloques recibidos;
- al recibir `partial_html_block`, anadirlo a estado incremental;
- renderizar/animar el bloque nuevo sin reparsear todo el documento;
- al evento `complete`, reconciliar con el payload final del backend.

Animacion propia:

- aparicion por bloque con fade/clip/reveal ligero;
- evitar animar caracter por caracter en documentos grandes;
- respetar `prefers-reduced-motion`;
- no bloquear interaccion ni paginacion.

### Frontend: paginacion HTML

Reemplazar `extractMarkdownBlocks` por `extractHtmlBlocks` o consumir `htmlBlocks`.

`pageLayout.ts` debe operar sobre `ContentPageBlock`.

Tipos sugeridos:

```ts
type ContentPageBlock =
	| {type: "heading"; level: 2 | 3 | 4; html: string; text: string}
	| {type: "paragraph"; html: string; text: string; splittable: true}
	| {type: "blockquote"; html: string; text: string; splittable: true}
	| {type: "list"; html: string; ordered: boolean; items: HtmlListItem[]}
	| {type: "table"; html: string; rows: HtmlTableRow[]}
	| {type: "code"; html: string; lines: string[]}
	| {type: "divider"; html: string};
```

Implementar helpers:

- `cloneNodeAtTextOffset(node, offset)`;
- `splitHtmlTextBlock(block, availableHeight)`;
- `splitListBlock(block, availableHeight)`;
- `splitTableByRows(block, availableHeight)`;
- `splitCodeByLines(block, availableHeight)`;
- `getTextContentLength(block)`.

Evitar offsets sobre HTML serializado.

### Frontend: render bridge para summaries

Crear utilidad de bridge:

```ts
summaryMarkdownToSafeHtml(summary: string): string
```

Uso:

- cabecera de primera pagina;
- medicion en `pageLayout.ts`;
- cualquier vista del lector que hoy inserte summary como texto plano o Markdown.

No cambia la generacion ni persistencia de summaries.

### Frontend: estilos

Actualizar `frontend/src/index.css`.

Debe incluir estilos coherentes para `.prose` y `.typography-scope`.

Anadir como minimo:

- `.prose h4`, `.typography-scope h4`;
- `.prose a`;
- `.prose blockquote`, `.typography-scope blockquote`;
- `.prose mark`;
- `.prose sub`, `.prose sup`;
- reglas consistentes de listas anidadas;
- ajustes de tablas para paginacion;
- reglas de `pre` y `code` que funcionen igual en editor y lectura.

Actualizar `typography.ts`:

- incluir metricas h4;
- incluir blockquote margins/padding;
- incluir table row/cell metrics si la medicion las necesita;
- incluir code block line height;
- mantener vars CSS sincronizadas.

### Frontend: toolbar

Actualizar `LexicalToolbar.tsx`.

Quitar:

- color picker;
- underline;
- Heading 1.

Mantener:

- undo/redo;
- paragraph;
- h2, h3, h4;
- bold;
- italic;
- link;
- ordered/unordered lists;
- code block.

Si Lexical genera `span` o `style` por alguna accion, el sanitizer debe limpiarlo, pero la UI no debe ofrecer controles que dependan de esos atributos.

## 4. Riesgos y mitigaciones

### Riesgo: divergencia entre streaming y reapertura

Mitigacion:

- `htmlBlocks` se deriva del HTML canonico;
- se guarda `htmlHash`;
- al reabrir se valida hash/version;
- si no coincide, se recalcula.

### Riesgo: carga del navegador

Mitigacion:

- backend emite bloques completos;
- frontend no reparsea documento completo por cada chunk;
- no animar caracter por caracter en documentos grandes;
- paginacion usa cache de medicion;
- recalculo de bloques ocurre en backend al guardar/generar, no en cada keystroke.

### Riesgo: sanitizer cambia contenido editado

Mitigacion:

- sanitizer compartido;
- frontend sanitiza antes de emitir;
- backend sanitiza de nuevo antes de guardar;
- toolbar alineado con allow-list.

### Riesgo: HTML parcial invalido en streaming

Mitigacion:

- no emitir chunks arbitrarios;
- emitir bloques semanticos completos desde backend;
- frontend solo renderiza bloques completos.

### Riesgo: tablas o codigo grandes rompen paginacion

Mitigacion:

- tablas por filas con `thead` repetido;
- codigo por lineas;
- fallback de overflow controlado para bloque patologico indivisible.

### Riesgo: despliegue con workspace shared

Mitigacion:

- declarar `shared` en root `workspaces`;
- frontend/backend dependen de `@didactio/shared` mediante workspace;
- build desde raiz o install workspace-aware;
- documentar requisito de despliegue.

## 5. Plan de implementacion recomendado

1. Crear paquete `shared`.
   - Allow-list canonica.
   - Sanitizer.
   - HTML text extraction.
   - HTML block extraction.
   - Hash/version.
   - Tests unitarios.

2. Actualizar tipos backend y compatibilidad legacy.
   - `contentFormat`.
   - HTML fields.
   - Revisions con format.
   - API detail response.

3. Implementar backend HTML generation.
   - Prompt HTML.
   - Sanitizacion.
   - Normalizacion.
   - Recap extraction.
   - Blocks/hash.
   - Reintento/refund.

4. Implementar streaming por bloques.
   - Evento NDJSON nuevo.
   - Backend emite bloques.
   - Frontend client acepta evento.

5. Adaptar frontend data layer.
   - API types.
   - Adapters.
   - Reading time desde HTML text.
   - Legacy detection.

6. Crear editor HTML.
   - Inicializacion HTML.
   - Serializacion HTML.
   - Sanitizacion frontend.
   - Toolbar alineado.

7. Migrar paginacion.
   - `ContentPageBlock`.
   - Split hibrido.
   - Medicion DOM con HTML.
   - Progreso por textContent.

8. Completar estilos.
   - CSS de tags permitidos.
   - Vars de tipografia.
   - Medicion igual al render.

9. Implementar UX legacy y revisions bloqueadas.
   - Placeholder.
   - Coste visible.
   - Regeneracion manual.
   - Restore disabled para Markdown.

10. Cleanup.
   - Retirar utilidades Markdown muertas del cuerpo del modulo.
   - Mantener utilidades Markdown necesarias para syllabus/summaries bridge.
   - Actualizar tests antiguos.

## 6. Plan de pruebas

### Backend unit tests

- Sanitizer:
  - elimina `script`, `style`, eventos `on*`;
  - elimina `javascript:` en links;
  - preserva `https`, `mailto` y anchors;
  - degrada `h1` a `h2`;
  - degrada `h5/h6` a `h4`;
  - preserva `code.language-*`;
  - elimina clases arbitrarias;
  - preserva `colspan`, `rowspan`, `scope` validos;
  - rechaza output vacio.

- HTML blocks:
  - extrae headings;
  - extrae parrafos;
  - extrae listas anidadas;
  - extrae tablas;
  - extrae code blocks por lineas;
  - calcula `textLength` y offsets sobre `textContent`.

- Normalizer:
  - localiza recap final traducido;
  - extrae continuity summary como texto plano;
  - falla si no hay contenido util.

- Coins:
  - primer intento invalido y segundo valido: no doble cobro;
  - dos intentos invalidos: refund y error;
  - regeneracion legacy cobra coste normal.

- Persistencia:
  - nueva generacion guarda `contentFormat: "html"`;
  - edicion manual recalcula hash/bloques;
  - apertura lazy recalcula si version/hash no coinciden;
  - revision Markdown queda con `contentFormat: "markdown"`.

### Frontend unit tests

- API/adapters:
  - HTML no pasa por `normalizeStoredMarkdown`;
  - legacy Markdown se detecta correctamente;
  - reading time HTML usa texto plano.

- Streaming:
  - recibe bloques completos;
  - no depende de `partial_markdown`;
  - reconciliacion final no duplica contenido;
  - respeta reduced motion.

- Editor:
  - inicializa desde HTML;
  - serializa a HTML sanitizado;
  - toolbar no muestra color/underline/H1;
  - H4 funciona si esta habilitado;
  - links invalidos se eliminan o neutralizan.

- Legacy UX:
  - placeholder aparece para `contentFormat: "markdown"`;
  - editor queda oculto/bloqueado;
  - restore revision Markdown disabled.

- Summary bridge:
  - Markdown summary se convierte a HTML sanitizado;
  - links peligrosos se eliminan;
  - medicion usa el mismo HTML que render.

### Paginacion tests

- Parrafo largo con `strong` y `em` partido por caracteres.
- Listas anidadas partidas sin romper jerarquia.
- Tabla de muchas filas partida por filas con `thead` repetido.
- Bloque de codigo largo partido por lineas.
- Heading al final de pagina se empuja.
- Progreso por `textContent` no cambia por atributos o formato HTML.

### E2E

- Generar modulo nuevo:
  - streaming por bloques;
  - animacion ligera;
  - contenido final coincide al reabrir.

- Editar modulo:
  - guardar HTML;
  - backend sanitiza;
  - hash/bloques se actualizan;
  - reabrir mantiene render.

- Regenerar legacy:
  - placeholder previo;
  - coste visible;
  - regeneracion produce HTML;
  - progreso se resetea.

- Revisions:
  - revision HTML restaurable;
  - revision Markdown visible pero no restaurable.

## 7. Ramificaciones controladas

Archivos/superficies que deben revisarse como parte del cambio:

- `backend/src/didactic-unit/didactic-unit-chapter.ts`
- `backend/src/didactic-unit/create-didactic-unit.ts`
- `backend/src/didactic-unit/generate-didactic-unit-chapter.ts`
- `backend/src/didactic-unit/update-didactic-unit-chapter.ts`
- `backend/src/didactic-unit/module-reading-progress.ts`
- `backend/src/didactic-unit/list-didactic-unit-chapters.ts`
- `backend/src/didactic-unit/summarize-didactic-unit.ts`
- `backend/src/ai/prompt-builders.ts`
- `backend/src/ai/service.ts`
- `backend/src/ai/ndjson.ts`
- `backend/src/ai/markdown-parsers.ts`
- `backend/src/app.ts`
- `backend/src/generation-runs/generation-run-store.ts`
- `frontend/src/dashboard/api/dashboardApi.ts`
- `frontend/src/dashboard/adapters.ts`
- `frontend/src/dashboard/types.ts`
- `frontend/src/dashboard/components/Editor/UnitEditor.tsx`
- `frontend/src/dashboard/components/Editor/LexicalMarkdownEditor.tsx`
- `frontend/src/dashboard/components/Editor/LexicalToolbar.tsx`
- `frontend/src/dashboard/components/Editor/ChapterStyleMenu.tsx`
- `frontend/src/dashboard/pageLayout.ts`
- `frontend/src/dashboard/utils/markdown.ts`
- `frontend/src/dashboard/utils/typography.ts`
- `frontend/src/dashboard/utils/fontLoader.ts`
- `frontend/src/index.css`
- `frontend/package.json`
- `backend/package.json`
- root `package.json`
- root `package-lock.json`

Nota: `subjectStyles.ts` no cambia el contenido HTML, pero si el lector usa estilos visuales por tema o materia, hay que verificar que sus colores/iconos no se acoplan a clases Markdown antiguas. La superficie critica de estilos reales es `index.css` + `typography.ts` + medicion DOM en `pageLayout.ts`.

## 8. Supuestos

- No se hace migracion masiva de contenido Markdown antiguo.
- El usuario regenera manualmente cada modulo legacy.
- El paquete `shared` se puede introducir como workspace local.
- La salida HTML de IA se considera no confiable hasta sanitizar en backend.
- El frontend nunca es la unica barrera de seguridad.
- El render normal y el streaming deben converger al mismo HTML sanitizado y bloques derivados.
- El contenido de summaries/overview no cambia en origen, solo cambia su render dentro del lector.

