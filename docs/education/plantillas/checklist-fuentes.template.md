# Plantilla: Checklist de fuentes (OSINT responsable)

> Plantilla reutilizable. Una fuente no verificada **no se usa**. Material de
> formación: no sustituye la revisión editorial final ni activa producción.

## Identificación de la fuente

- **Título:** `<title>`
- **Editor/Publisher:** `<publisher>`
- **URL:** `<url>`
- **Fecha de acceso (`accessed_at`):** `<AAAA-MM-DD>`
- **Tipo:** `<institucional | prensa | académica | ...>`

## Verificación

- [ ] La fuente es **abierta** y accesible.
- [ ] Es una fuente **primaria o autorizada** (o cita a una).
- [ ] La información es **contrastable** con otra fuente independiente.
- [ ] Marca de `verification`: `<verified | demo>`.

## Trazabilidad

- [ ] Se conserva la URL exacta y la fecha de acceso.
- [ ] Se puede vincular a un `causal_link` o a un campo del contrato v1.
- [ ] Queda registrada en `sources[]` del foco.

## Sesgo y OSINT responsable

- [ ] Se identifica el **posible sesgo** del editor.
- [ ] **No** se usan datos personales ni técnicas intrusivas.
- [ ] Se distingue **hecho** de **opinión/análisis**.

## Decisión

- **Resultado:** `<UTILIZABLE | NO UTILIZABLE>`
- **Justificación:** `<motivo>`
