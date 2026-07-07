# Checklist del instructor

> Recorre esta lista **antes de aceptar** cualquier evaluación puntuada.
> Material de formación: no activa producción ni maneja datos personales.

## Anonimato y privacidad

- [ ] La evaluación es **anónima**: no contiene nombre, email, DNI/NIE, teléfono,
      dirección ni `student_id`/matrícula.
- [ ] El motor de puntuación **no reportó claves con aspecto de PII**
      (si las reporta, la evaluación se rechaza automáticamente).
- [ ] No se ha copiado ninguna nota real a un fichero versionado.

## Integridad de la rúbrica

- [ ] La evaluación referencia una `rubric_id` existente en `rubrics.index.json`.
- [ ] Cada criterio de la rúbrica está puntuado **exactamente una vez**.
- [ ] Cada nivel usado existe en la escala (`insuficiente…excelente`).
- [ ] No hay criterios desconocidos en la evaluación.

## Coherencia pedagógica

- [ ] El nivel asignado por criterio es **coherente con la evidencia** aportada.
- [ ] El caso analizado pertenece al **banco de casos** o a un foco del contrato v1.
- [ ] Los enlaces causales citados coinciden con la fuente (ver backlog causal).
- [ ] Los campos `pending` del caso están reconocidos, no ignorados.

## Salida y feedback

- [ ] El feedback por criterio propone el **siguiente nivel** cuando no es el máximo.
- [ ] La banda global (`insuficiente/suficiente/notable/excelente`) es plausible.
- [ ] Se ha generado feedback docente con la plantilla
      (`docs/education/feedback-templates/`).

## Garantías finales

- [ ] `is_production=false`, sin activación de gate ni secretos.
- [ ] La arquitectura reversible (API v1 → JSON estático → fallback) no se toca.
