# Changelog

## v1.0.0 — 2026-10-09

- Primera versión: reemplaza el resumen de compactación de OpenCode v2 por uno de 10 secciones al estilo Claude Code, generado con el modelo de la sesión sobre el historial completo.
- Si falla o el resumen no trae las secciones esperadas, se usa el resumen de fábrica.
- Registra errores en `/tmp/claude-compaction.log`.
