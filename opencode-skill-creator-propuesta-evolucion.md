# Propuesta de evolución de `opencode-skill-creator`

> Documento de implementación para crear un fork mantenible de `antongulin/opencode-skill-creator`, incorporando selectivamente las mejores prácticas de Anthropic, Superpowers, OpenAI, Microsoft y Matt Pocock, y manteniendo Comet como integración opcional.
>
> **Objetivo principal:** mejorar la calidad de creación, evaluación y mantenimiento de Agent Skills para OpenCode sin convertir el proyecto en un framework nuevo ni romper la capacidad de sincronizar cambios desde upstream.

---

## 1. Decisión arquitectónica

### Base del fork

El fork **DEBE basarse directamente en**:

- Repositorio base:  
  https://github.com/antongulin/opencode-skill-creator

Este proyecto debe conservarse como **upstream técnico principal**.

La intención NO es reconstruir un Skill Creator desde cero. El fork debe reutilizar y preservar, siempre que sea posible:

- integración nativa con OpenCode;
- plugin TypeScript;
- creación de skills;
- validación existente;
- sistema de evals;
- benchmarking;
- optimización de `description`;
- review;
- instalación;
- compatibilidad con el runtime/plugin API de OpenCode.

### Política de upstream

Configurar Git de forma que el fork pueda mantenerse sincronizado:

```bash
git remote -v

origin    <URL-DEL-FORK>
upstream  https://github.com/antongulin/opencode-skill-creator.git
```

Flujo recomendado:

```bash
git fetch upstream
git checkout main
git rebase upstream/main
```

Evitar modificar innecesariamente código central del upstream.

Siempre que sea posible, las mejoras propias deben implementarse como:

- módulos adicionales;
- estrategias intercambiables;
- nuevos evaluadores;
- reglas/lints;
- adapters;
- tests;
- documentación.

---

# 2. Principios de diseño

El fork debe seguir estos principios:

1. **Probar primero que una skill es necesaria.**
2. **Probar que la skill cambia el comportamiento del agente.**
3. **Probar que sigue funcionando bajo presión y casos adversos.**
4. **Mantener solamente instrucciones que aporten una mejora observable.**
5. **Favorecer scripts/código cuando una operación pueda hacerse de forma determinista.**
6. **Aplicar progressive disclosure para reducir contexto innecesario.**
7. **Mantener compatibilidad con la especificación abierta de Agent Skills.**
8. **No acoplar el core a Comet, Gentle AI u otro harness.**
9. **Mantener el delta respecto a upstream tan pequeño como sea razonable.**
10. **No crear un formato propio de skill.**

Nombre conceptual sugerido para la metodología:

> **Evidence-driven Agent Skill Authoring**

No es necesario cambiar inmediatamente el nombre del proyecto.

---

# 3. Referencias normativas y metodológicas

## 3.1 Base técnica — OpenCode Skill Creator

### Repositorio

https://github.com/antongulin/opencode-skill-creator

### Debe ser la referencia para

- arquitectura del plugin;
- integración con OpenCode;
- lifecycle;
- herramientas TypeScript;
- evals existentes;
- benchmark;
- optimización de triggering;
- revisión;
- instalación;
- compatibilidad con OpenCode.

### Regla

**No duplicar funcionalidades que Anton ya implementa correctamente.**

Antes de implementar una nueva feature:

1. revisar la versión actual del upstream;
2. comprobar que la capacidad no exista;
3. reutilizar interfaces existentes;
4. añadir solamente el delta necesario.

---

# 4. Referencia principal de metodología — Anthropic Skill Creator

## Repositorio

https://github.com/anthropics/skills

## Skill directo

https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

### Basarse en Anthropic para

- creación iterativa de skills;
- evaluación con ejemplos reales;
- baseline;
- comparación:
  - `without_skill`;
  - `with_skill`;
  - `previous_version`, cuando exista;
- evaluación cualitativa;
- evaluación cuantitativa;
- análisis de transcripts;
- benchmark;
- optimización de description/triggering;
- identificación de tareas repetitivas que deberían transformarse en scripts;
- revisión humana cuando el resultado no pueda reducirse a métricas fiables.

### Principio a preservar

Una skill no debe considerarse buena porque:

```text
"el resultado parece correcto"
```

Debe poder demostrarse que:

```text
resultado con skill
>
resultado sin skill
```

para los escenarios que justificaron su existencia.

---

# 5. Referencia principal de Behavioral TDD — Superpowers

## Repositorio

https://github.com/obra/superpowers

## Skill directo

https://github.com/obra/superpowers/tree/main/skills/writing-skills

## `SKILL.md`

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

## Referencia adicional de mejores prácticas Anthropic incluida en Superpowers

https://github.com/obra/superpowers/blob/main/skills/writing-skills/anthropic-best-practices.md

### Incorporar la metodología RED → GREEN → REFACTOR

```text
RED
↓
ejecutar escenario sin skill
↓
observar fallo real

GREEN
↓
crear la mínima instrucción necesaria
↓
probar nuevamente

REFACTOR
↓
buscar evasiones, racionalizaciones y casos adversos
↓
cerrar loopholes
↓
volver a probar
```

### Cambio propuesto

Añadir un concepto formal de **Behavioral TDD para skills**.

Cada eval importante debería poder registrar:

```yaml
case:
  type: pressure
  intent: "..."
  expected_behavior: "..."
  baseline_behavior: "..."
  observed_behavior: "..."
  result: pass|fail
```

No se requiere adoptar este schema literalmente; debe adaptarse a la arquitectura del upstream.

---

# 6. Clasificación de skills para elegir el tipo de evaluación

Basarse principalmente en:

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

Añadir una clasificación interna que permita seleccionar estrategias de prueba diferentes.

## Tipos iniciales

### `discipline`

Skills destinadas a imponer reglas o disciplina:

- TDD;
- verification-before-completion;
- security gates;
- no modificar producción sin evidencia;
- procesos obligatorios.

Evaluarlas con:

- presión de tiempo;
- instrucciones contradictorias;
- autoridad;
- costo hundido;
- fatiga/contexto largo;
- tentación de saltarse pasos.

### `technique`

Skills destinadas a enseñar una técnica:

- debugging;
- root cause analysis;
- migrations;
- refactoring;
- profiling.

Evaluarlas con:

- aplicación correcta;
- edge cases;
- información incompleta;
- variantes del problema.

### `pattern`

Skills para reconocer cuándo aplicar una solución.

Evaluar:

- cuándo aplica;
- cuándo NO aplica;
- falsos positivos;
- falsos negativos.

### `reference`

Skills principalmente documentales.

Evaluar:

- retrieval;
- cobertura;
- selección de referencia correcta;
- aplicación correcta de la información.

### `workflow`

Skills que coordinan varios pasos.

Evaluar:

- orden;
- precondiciones;
- handoffs;
- outputs;
- recuperación de errores;
- finalización.

---

# 7. Pressure tests y rationalization tests

Basarse en:

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

Añadir soporte para capturar explícitamente:

```yaml
rationalization:
  trigger: "..."
  agent_reasoning_summary: "..."
  violated_rule: "..."
  mitigation: "..."
```

El objetivo NO es guardar chain-of-thought privada.

Debe guardarse únicamente una **explicación observable/resumida del motivo del fallo**, por ejemplo:

```text
El agente omitió los tests porque consideró el cambio demasiado pequeño.
```

El sistema debe poder convertir patrones recurrentes en nuevos casos de regresión.

### Flujo

```text
pressure test
    ↓
failure
    ↓
identify rationalization pattern
    ↓
adjust instruction
    ↓
rerun
    ↓
store regression case
```

---

# 8. Instruction usefulness testing

## Referencia principal

Repositorio:

https://github.com/mattpocock/skills

Skill actual:

https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md

Skill mechanics:

https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL-MECHANICS.md

### Objetivo

Evitar instrucciones que no cambian significativamente el comportamiento del agente.

Ejemplo de instrucción débil:

```text
Write clean, maintainable code.
```

Si el agente ya realiza ese comportamiento de forma consistente sin la instrucción, esa frase consume contexto sin aportar suficiente señal.

### Cambio propuesto

Añadir una comprobación opcional denominada conceptualmente:

```text
instruction usefulness
```

Debe comparar una variante con y sin la instrucción cuando sea razonable.

Resultado posible:

```yaml
instruction:
  text: "..."
  baseline_pass_rate: 0.96
  with_instruction_pass_rate: 0.97
  delta: 0.01
  recommendation: remove
```

No fijar inicialmente un umbral universal.

El criterio debe depender del tamaño de muestra, tipo de skill y variabilidad del modelo.

---

# 9. Progressive disclosure y estructura de recursos

## Referencias

### Agent Skills specification

Repositorio:

https://github.com/agentskills/agentskills

Especificación:

https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx

### OpenAI Skill Creator

Repositorio:

https://github.com/openai/skills

Skill directo:

https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md

### Microsoft Skill Creator

Repositorio:

https://github.com/microsoft/skills

Skill directo:

https://github.com/microsoft/skills/blob/main/.github/skills/skill-creator/SKILL.md

### Estructura preferida

Mantener compatibilidad con:

```text
my-skill/
├── SKILL.md
├── scripts/
├── references/
├── assets/
└── ...
```

No hacer obligatorias carpetas que la especificación considere opcionales.

### Criterio

`SKILL.md` debe contener:

- comportamiento esencial;
- triggers;
- decisiones críticas;
- workflow común;
- guardrails realmente necesarios.

Mover a `references/`:

- documentación extensa;
- API docs;
- edge cases poco frecuentes;
- tablas grandes;
- material de consulta.

Mover a `scripts/`:

- transformaciones deterministas;
- validaciones;
- parsing;
- generación repetitiva;
- tareas que no requieren razonamiento del modelo.

Mover a `assets/`:

- templates;
- recursos que deban copiarse o reutilizarse como artefactos;
- archivos de salida base.

---

# 10. Token/context budget

## Referencia principal

Microsoft Skill Creator:

https://github.com/microsoft/skills/blob/main/.github/skills/skill-creator/SKILL.md

También consultar:

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

### Cambio propuesto

Añadir un `skill lint` o validación equivalente que mida como mínimo:

```text
SKILL.md words
SKILL.md tokens estimados
number of references
reference depth
largest reference
duplicate sections
number of examples
```

### Configuración sugerida

No convertir inicialmente límites en reglas rígidas.

Ejemplo:

```yaml
budgets:
  skill_md:
    warning_words: 500
    error_words: null

  frequent_skill:
    warning_words: 250

  reference_depth:
    warning: 2
```

Debe ser configurable.

### Output esperado

```text
✓ frontmatter valid
✓ Agent Skills-compatible structure
✓ description contains trigger conditions
✓ references reachable
⚠ SKILL.md: 724 words (recommended <= 500)
⚠ reference nesting depth: 3
✓ no duplicate examples detected
```

---

# 11. Description / trigger optimization

## Referencias principales

Anton:

https://github.com/antongulin/opencode-skill-creator

Anthropic:

https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

Superpowers:

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

### Conservar de Anton

No reemplazar su sistema existente de optimización.

### Extender únicamente si es necesario

El conjunto de pruebas debe distinguir:

```text
should_trigger
should_not_trigger
ambiguous
```

Debe evitar que `description` replique todo el workflow.

Preferir que `description` explique:

```text
WHAT + WHEN
```

y que `SKILL.md` explique:

```text
HOW
```

---

# 12. Pipeline objetivo

El fork debería converger gradualmente hacia este pipeline:

```text
1. DEFINE
   │
   ├─ intent
   ├─ trigger
   ├─ expected outcomes
   └─ skill type
   ↓

2. BASELINE
   │
   └─ ejecutar escenarios SIN skill
   ↓

3. PROVE NEED
   │
   ├─ ¿existe un fallo observable?
   │
   ├─ NO → no crear o justificar excepción
   │
   └─ SÍ
   ↓

4. CREATE MINIMAL SKILL
   ↓

5. STRUCTURAL VALIDATION
   │
   ├─ frontmatter
   ├─ schema
   ├─ references
   ├─ paths
   └─ Agent Skills compatibility
   ↓

6. CONTEXT / TOKEN LINT
   ↓

7. BEHAVIORAL EVAL
   │
   ├─ without_skill
   ├─ with_skill
   └─ previous_version cuando exista
   ↓

8. PRESSURE / ADVERSARIAL EVAL
   ↓

9. RATIONALIZATION ANALYSIS
   ↓

10. TRIGGER EVAL
    │
    ├─ should_trigger
    ├─ should_not_trigger
    └─ ambiguous
    ↓

11. OPTIMIZATION
    │
    ├─ description
    ├─ instructions
    ├─ structure
    └─ token usage
    ↓

12. REGRESSION
    ↓

13. HUMAN REVIEW
    ↓

14. INSTALL / EXPORT
```

No es obligatorio implementar las 14 fases como comandos separados.

El diseño debe reutilizar el workflow actual de Anton y añadir las capacidades faltantes con el menor delta posible.

---

# 13. Recomendación de implementación por versiones

## V1 — Behavioral TDD

### Objetivo

Añadir el mayor valor posible con mínima divergencia respecto a upstream.

Implementar:

- skill type;
- baseline obligatorio/recomendado según tipo;
- `failure_case`;
- pressure cases;
- rationalization capture;
- regression from discovered failures.

### Referencia principal

Superpowers:

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

### Criterio de finalización

Debe ser posible demostrar:

```text
scenario fails without skill
scenario passes with skill
pressure scenario still passes
```

---

# 14. V1.1 — Context budget + progressive disclosure lint

Implementar:

- word/token estimate;
- warnings por tamaño;
- reference depth;
- duplicate/redundant content detection;
- sugerencias para mover contenido a:
  - scripts;
  - references;
  - assets.

### Referencias

Microsoft:

https://github.com/microsoft/skills/blob/main/.github/skills/skill-creator/SKILL.md

OpenAI:

https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md

Agent Skills:

https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx

---

# 15. V1.2 — Instruction usefulness analysis

Implementar de manera opcional:

```text
baseline instruction set
vs
candidate instruction set
```

Objetivo:

- detectar no-ops;
- detectar reglas redundantes;
- detectar instrucciones con mejora marginal no justificable;
- reducir contexto.

### Referencia

Matt Pocock:

https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md

---

# 16. V1.3 — Comet adapter opcional

## NO integrar Comet dentro del core

Comet debe permanecer como consumidor/integrador externo.

### Repositorio

https://github.com/rpamis/comet

### `comet-any`

https://github.com/rpamis/comet/tree/master/assets/skills/comet-any

### `SKILL.md` directo

https://github.com/rpamis/comet/blob/master/assets/skills/comet-any/SKILL.md

### Responsabilidad del adapter

Permitir que una skill validada pueda proporcionar metadata/export útil para Comet sin cambiar el formato base.

Arquitectura conceptual:

```text
Atomic Skill
    │
    ▼
OpenCode Skill Creator fork
    │
    ├─ validate
    ├─ eval
    ├─ optimize
    └─ approve
    │
    ▼
optional Comet adapter
    │
    ▼
Comet / comet-any
    │
    ▼
multi-skill workflow composition
```

### Regla crítica

El fork NO debe:

- implementar el workflow engine de Comet;
- copiar `comet-any`;
- depender de Comet para crear una skill;
- introducir schemas privados de Comet dentro de `SKILL.md`;
- convertir Comet en dependencia obligatoria.

---

# 17. Comet como referencia de composición, no de authoring atómico

Usar `comet-any` como referencia cuando el problema sea:

```text
Skill A
+
Skill B
+
Skill C
↓
Workflow compuesto
```

No cuando el problema sea:

```text
crear una única skill
```

Conceptos de Comet que pueden inspirar futuras integraciones:

- workflow contracts;
- node responsibilities;
- bindings;
- guardrails;
- output schemas;
- handoffs;
- readiness;
- publish review;
- evidence gates.

No implementarlos en V1 salvo que exista una necesidad demostrada.

---

# 18. Qué NO debe incorporarse directamente

## Gentleman Skills

Repositorio:

https://github.com/Gentleman-Programming/Gentleman-Skills

Puede utilizarse como referencia secundaria de compatibilidad con múltiples agentes, pero **no copiar su skill-creator completa**.

Motivo:

- solapamiento significativo;
- Anton ya proporciona una base específica para OpenCode;
- añadir otra metodología completa aumentaría ruido.

---

## Francy Agent Skill Creator

Repositorio:

https://github.com/FrancyJGLisboa/agent-skill-creator

Usar únicamente como referencia futura para:

- packaging;
- distribución;
- cross-platform;
- security gates.

No incorporar su pipeline completo en las primeras versiones.

---

# 19. Lo que debe permanecer upstream-owned

Evitar modificar salvo necesidad demostrada:

```text
OpenCode plugin lifecycle
installation lifecycle
OpenCode API integration
existing benchmark engine
existing trigger optimizer
existing evaluator core
existing review UI
package/build/release pipeline
```

Si se requiere un cambio en una de estas áreas:

1. comprobar si puede resolverse mediante extensión;
2. comprobar issues/PRs upstream;
3. preferir contribuir upstream;
4. sólo mantener un patch propio si no existe alternativa.

---

# 20. Diseño de módulos sugerido

No es obligatorio adoptar esta estructura literalmente.

Debe adaptarse a la estructura actual del upstream.

```text
opencode-skill-creator/
│
├── plugin/
│   ├── ...
│   └── extensions/
│       ├── behavioral-tdd/
│       ├── pressure-eval/
│       ├── rationalization/
│       ├── context-budget/
│       └── instruction-quality/
│
├── methodologies/
│   ├── behavioral-tdd.md
│   ├── progressive-disclosure.md
│   ├── instruction-quality.md
│   └── evaluation-strategy.md
│
├── adapters/
│   └── comet/
│
└── tests/
```

Preferir integración con módulos/interfaces existentes antes de crear nuevas capas.

---

# 21. Modelos de datos conceptuales

Estos schemas son ilustrativos.

No deben imponerse si chocan con los modelos existentes.

## Eval case

```yaml
id: verify-before-completion-pressure-01
type: pressure

skill_type: discipline

prompt: |
  ...

expected:
  behavior:
    - run verification before claiming completion

baseline:
  required: true

tags:
  - time-pressure
  - completion
```

## Result

```yaml
case_id: verify-before-completion-pressure-01

without_skill:
  passed: false

with_skill:
  passed: true

previous_version:
  passed: null

observations:
  - "Agent initially attempted to claim completion before verification."

rationalization_summary:
  - "Change was considered too small to justify full verification."
```

No almacenar razonamiento privado detallado del modelo.

---

# 22. Regression suite

Cada bug conductual encontrado debería poder convertirse en regression case.

Ejemplo:

```text
production failure
       ↓
minimal reproducible prompt
       ↓
eval case
       ↓
fix skill
       ↓
test passes
       ↓
case remains permanently in regression suite
```

Esto permite evolucionar una skill con evidencia en lugar de acumular reglas anecdóticas.

---

# 23. Human review

Mantener revisión humana para casos donde las métricas automáticas no sean suficientes.

La revisión debería mostrar, cuando sea posible:

```text
prompt

without_skill
with_skill
previous_version

rubric
metrics
token usage

observed failures
rationalization summaries

review decision
```

Evitar revelar o almacenar chain-of-thought privada.

---

# 24. Evaluación de regresión al modificar una skill

Toda modificación relevante debería considerar:

```text
old skill
vs
new skill
```

No basta con:

```text
new skill
vs
no skill
```

porque una nueva versión puede mejorar un caso y romper otros.

Pipeline:

```text
existing regression suite
        ↓
old version benchmark
        ↓
new version benchmark
        ↓
compare
        ↓
detect regressions
```

---

# 25. Criterios de aceptación generales

Una versión del fork debe considerarse técnicamente saludable cuando:

- [ ] sigue pudiendo sincronizar cambios desde Anton upstream;
- [ ] conserva compatibilidad con OpenCode;
- [ ] no introduce un formato propio de Agent Skill;
- [ ] las nuevas funciones tienen tests;
- [ ] behavioral evals pueden compararse contra baseline;
- [ ] pressure tests pueden ejecutarse de manera reproducible;
- [ ] los fallos pueden convertirse en regression cases;
- [ ] token/context lint funciona sin bloquear innecesariamente;
- [ ] Comet permanece opcional;
- [ ] el core no depende de Gentle AI;
- [ ] una skill resultante puede seguir utilizándose fuera del fork;
- [ ] documentación explica claramente qué parte proviene/inspira cada referencia.

---

# 26. Non-goals

La primera etapa NO debe intentar:

- crear un nuevo Agent Skills standard;
- crear otro harness;
- reemplazar Comet;
- reemplazar Gentle AI;
- implementar un workflow orchestrator;
- soportar todos los agentes existentes;
- copiar todos los Skill Creators disponibles;
- introducir un marketplace;
- crear dependency resolution complejo;
- crear telemetría cloud obligatoria;
- crear una plataforma SaaS;
- reescribir Anton desde cero.

---

# 27. Orden recomendado para OpenCode al implementar

Antes de modificar código:

1. inspeccionar la arquitectura actual del repositorio;
2. leer el `README`;
3. identificar plugin entrypoints;
4. identificar modelos de eval existentes;
5. identificar tests existentes;
6. identificar comandos/tools disponibles;
7. documentar qué funcionalidad ya existe;
8. mapear la propuesta de este documento contra capacidades existentes;
9. eliminar del plan todo lo que ya esté resuelto;
10. implementar únicamente gaps confirmados.

### Regla

> No implementar una feature solamente porque aparece en este documento.  
> Primero verificar si el upstream actual ya la ofrece o si existe una solución equivalente.

---

# 28. Fase previa obligatoria: Gap Analysis

OpenCode debe generar antes un documento temporal similar a:

```markdown
# Gap Analysis

## Existing upstream capabilities

| Capability | Exists | Location | Notes |
|---|---:|---|---|
| baseline eval | yes | ... | ... |
| trigger optimizer | yes | ... | ... |
| pressure tests | no | - | gap |
| rationalization capture | partial | ... | ... |
| token budget lint | no | - | gap |

## Proposed changes actually required

1. ...
2. ...
3. ...

## Changes rejected as redundant

1. ...
2. ...
```

Sólo después debe comenzar la implementación.

---

# 29. Estrategia de commits

Mantener commits pequeños y separables.

Ejemplo:

```text
feat(eval): add skill type classification
feat(eval): add pressure case support
feat(eval): capture rationalization summaries
feat(eval): add regression case promotion
feat(lint): add skill context budget warnings
feat(lint): detect deep reference nesting
feat(eval): add instruction usefulness experiment
feat(comet): add optional export adapter
docs: document evidence-driven authoring workflow
```

No introducir todo en un único commit.

---

# 30. Estrategia de ramas

Ejemplo:

```text
main
│
├── feat/behavioral-tdd
├── feat/context-budget
├── feat/instruction-usefulness
└── feat/comet-adapter
```

`main` debe permanecer funcional y rebaseable contra upstream.

---

# 31. Prioridad final

## P0 — conservar upstream limpio

- Anton como base;
- upstream sync;
- tests existentes;
- no reescritura.

## P1 — Behavioral TDD

Basarse principalmente en:

https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

## P2 — baseline/eval discipline

Basarse en:

https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

y reutilizar la implementación ya existente de Anton.

## P3 — context/token discipline

Basarse en:

https://github.com/microsoft/skills/blob/main/.github/skills/skill-creator/SKILL.md

https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md

## P4 — instruction usefulness

Basarse en:

https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md

## P5 — Comet adapter

Basarse en:

https://github.com/rpamis/comet/tree/master/assets/skills/comet-any

Únicamente si aparece una necesidad real de composición/export.

---

# 32. Matriz de procedencia

| Capacidad | Fuente principal | Integración propuesta |
|---|---|---|
| OpenCode plugin/tooling | Anton | Conservar |
| Skill creation pipeline | Anton + Anthropic | Extender, no reemplazar |
| Baseline eval | Anthropic / Anton | Conservar y reforzar |
| Behavioral TDD | Superpowers | Añadir |
| Pressure scenarios | Superpowers | Añadir |
| Rationalization testing | Superpowers | Añadir |
| Trigger optimization | Anton + Anthropic | Conservar |
| Progressive disclosure | Agent Skills + OpenAI | Añadir lint |
| Token/context discipline | Microsoft | Añadir lint |
| Instruction usefulness | Matt Pocock | Añadir experimental |
| Skill specification | Agent Skills | Compatibilidad obligatoria |
| Workflow composition | Comet | Adapter opcional |
| Multi-platform packaging | Francy | Posponer |
| Simple cross-agent authoring | Gentleman | Referencia secundaria |

---

# 33. URLs de referencia

## Base obligatoria

### Anton — OpenCode Skill Creator
https://github.com/antongulin/opencode-skill-creator

---

## Referencias principales

### Anthropic Skills
https://github.com/anthropics/skills

### Anthropic Skill Creator
https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md

### Superpowers
https://github.com/obra/superpowers

### Superpowers — Writing Skills
https://github.com/obra/superpowers/tree/main/skills/writing-skills

### Superpowers — Writing Skills / SKILL.md
https://github.com/obra/superpowers/blob/main/skills/writing-skills/SKILL.md

### Superpowers — Anthropic Best Practices
https://github.com/obra/superpowers/blob/main/skills/writing-skills/anthropic-best-practices.md

### Agent Skills Specification
https://github.com/agentskills/agentskills

### Agent Skills specification document
https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx

---

## Referencias complementarias

### OpenAI Skills
https://github.com/openai/skills

### OpenAI Skill Creator
https://github.com/openai/skills/blob/main/skills/.system/skill-creator/SKILL.md

### Microsoft Skills
https://github.com/microsoft/skills

### Microsoft Skill Creator
https://github.com/microsoft/skills/blob/main/.github/skills/skill-creator/SKILL.md

### Matt Pocock Skills
https://github.com/mattpocock/skills

### Writing for Agents
https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md

### Writing for Agents — Skill Mechanics
https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL-MECHANICS.md

---

## Integración opcional

### Comet
https://github.com/rpamis/comet

### Comet `comet-any`
https://github.com/rpamis/comet/tree/master/assets/skills/comet-any

### Comet `comet-any/SKILL.md`
https://github.com/rpamis/comet/blob/master/assets/skills/comet-any/SKILL.md

---

## Referencias secundarias / futuras

### Gentleman Skills
https://github.com/Gentleman-Programming/Gentleman-Skills

### Agent Skill Creator — FrancyJGLisboa
https://github.com/FrancyJGLisboa/agent-skill-creator

---

# 34. Resultado deseado

El fork NO debe terminar siendo:

```text
"todos los Skill Creators unidos"
```

Debe convertirse en:

```text
Anton OpenCode Skill Creator
          │
          ├── Anthropic eval discipline
          │
          ├── Superpowers Behavioral TDD
          │
          ├── Agent Skills compatibility
          │
          ├── Microsoft/OpenAI context discipline
          │
          ├── Matt Pocock instruction minimalism
          │
          └── optional Comet integration
```

Con una filosofía central:

> **Crear la mínima skill necesaria, demostrar con evidencia que mejora el comportamiento del agente, probar que resiste casos adversos y conservar únicamente las instrucciones que justifican el contexto que consumen.**

---

# 35. Instrucción final para el agente implementador

Antes de realizar cualquier cambio:

1. comprobar la versión actual de cada referencia;
2. inspeccionar el código actual del fork/upstream;
3. generar el Gap Analysis;
4. descartar cambios redundantes;
5. crear un plan de implementación por fases;
6. mantener compatibilidad con upstream;
7. implementar V1 antes de avanzar a V1.1+;
8. ejecutar tests después de cada cambio;
9. comparar comportamiento antes/después;
10. documentar decisiones que generen divergencia respecto a upstream.

No sacrificar mantenibilidad por incorporar features.

**Una mejora sólo debe entrar si resuelve un gap demostrado.**
