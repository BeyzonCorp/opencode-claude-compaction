# opencode-claude-compaction

Plugin de **OpenCode v2** que reemplaza el resumen de compactación de fábrica por uno detallado, al estilo de Claude Code, para que el agente siga el hilo después de compactar en lugar de "perder la memoria".

## Por qué existe

OpenCode v2 resume la conversación con una plantilla fija (`## Objective`, `## Work State`, `## Next Move`…) que pide secciones concisas, omite lo que considera recuperable y descarta los pedidos ya respondidos. Además, al armar la transcripción para el resumen, recorta cada salida de herramienta a 1.250 caracteres. El resultado es que después de compactar se pierde buena parte del contexto.

La plantilla no se puede cambiar por configuración. Lo que sí ofrece la v2 es un gancho de plugin que permite entregar un resumen propio:

- `packages/plugin/src/effect/session.ts` — `SessionCompaction.result`: *"Set to use this compaction and skip the model request."*
- `packages/core/src/session/compaction.ts` — si un gancho entrega `result`, OpenCode usa ese resumen (`fromHook`) y no corre su plantilla.

## Qué hace

1. Se engancha a `ctx.session.hook("compaction")`.
2. Genera el resumen con `ctx.session.generate(...)`, usando el **modelo de la sesión** y el **historial completo** (sin el recorte de 1.250 caracteres).
3. Entrega un resumen con 10 secciones fijas:
   1. Pedido principal e intención (con el último pedido textual)
   2. Contexto técnico (rutas, stack, servicios, puertos)
   3. Decisiones y su porqué
   4. Archivos y código
   5. Errores y arreglos
   6. Estado verificado (separado de lo supuesto)
   7. Todos los mensajes del usuario, casi textuales
   8. Tareas pendientes
   9. Trabajo en curso (con cita textual)
   10. Próximo paso (con cita textual)
4. Si algo falla (error del modelo o resumen sin las secciones esperadas), **no toca nada** y OpenCode usa su resumen de fábrica. Nunca queda peor que sin el plugin.

Funciona igual para `/compact` y para la compactación automática.

## Requisitos

- OpenCode **v2.0.20** o superior.
- Acceso de lectura a este repositorio (es privado): tus credenciales de Git/GitHub deben poder clonarlo.

## Instalación

```sh
opencode plugin add github:BeyzonCorp/opencode-claude-compaction#v1.0.0
opencode service restart
```

Verificá que quedó registrado y que cargó sin errores (`opencode plugin list` no muestra los plugins instalados desde GitHub):

```sh
grep claude-compaction ~/.config/opencode/opencode.json
grep "failed to load plugin" ~/.local/share/opencode/log/opencode.log | grep claude-compaction
```

El primero debe mostrar la entrada del plugin y el segundo no debe mostrar nada. La prueba definitiva es compactar una sesión (`/compact`): el resumen debe empezar con `## 1. Primary request`.

## Configuración recomendada

El plugin decide **cómo** se escribe el resumen; **cuándo** se compacta y **cuánto** se conserva textual lo siguen controlando los ajustes de OpenCode. En `~/.config/opencode/opencode.json(c)`:

```jsonc
{
  "compaction": {
    "auto": true,
    "keep": { "tokens": 40000 }, // conversación reciente que queda sin resumir
    "buffer": 20000              // margen libre: compacta antes de llenar el contexto
  }
}
```

## Actualizar

Las versiones se publican como tags (`vX.Y.Z`). Para pasar a una versión nueva:

```sh
opencode plugin remove github:BeyzonCorp/opencode-claude-compaction#v1.0.0
opencode plugin add github:BeyzonCorp/opencode-claude-compaction#vX.Y.Z
opencode service restart
```

Ver [CHANGELOG.md](CHANGELOG.md).

## Desinstalar

```sh
opencode plugin remove github:BeyzonCorp/opencode-claude-compaction#v1.0.0
opencode service restart
```

## Limitaciones

- **Modelo:** el resumen lo escribe el modelo de la sesión (no hay forma de elegir otro con `generate`), así que consume cuota de ese modelo.
- **Compactación de emergencia:** si el proveedor rechaza un pedido por demasiado largo, el pedido del plugin (historial completo) puede ser rechazado también; en ese caso se usa el resumen de fábrica. El `buffer` existe para que casi nunca se llegue ahí.
- **Compactación nativa:** si un proveedor tiene `settings.compaction.type: "native"`, OpenCode usa otro camino y el plugin no interviene.

## Diagnóstico

Los errores del plugin se registran en `/tmp/claude-compaction.log`. Si un resumen sale con `## Objective`, se usó el de fábrica: revisá ese archivo y el log de OpenCode (`~/.local/share/opencode/log/opencode.log`).

## Desarrollo

- El código está en `src/index.ts`. Exporta por defecto un objeto `{ id, setup }`, sin importar `@opencode/plugin`: un plugin local no puede resolver ese paquete, y la v2 solo exige esa forma.
- Para probar cambios sin publicar, copiá `src/index.ts` a `~/.config/opencode/plugins/claude-compaction.ts`, reiniciá el servicio y forzá una compactación con `opencode api POST /api/session/<id>/compact -d '{}'`. No lo tengas instalado de las dos formas a la vez.
- Para publicar: actualizá `version` en `package.json` y el `CHANGELOG.md`, hacé commit, creá el tag `vX.Y.Z` y subilo.
