# Centro Logístico 3D

Simulador 3D de un centro de distribución sobre la Ruta 5 (Montevideo, Uruguay) para clases universitarias de
logística: gestión de inventario, costos, operación de la nave y transporte terrestre a las capitales
departamentales. Tiene modo juego (decisiones semana a semana, con competencia entre grupos) y modo simulador.

- **Nave en 3D:** estanterías con los pallets del stock simulado de cada día, andenes con camiones, autoelevadores,
  oficinas y patio. Al tocar un pallet se ve su producto y su política con los números.
- **Mapa de entregas:** Uruguay con las rutas nacionales y los camiones en viaje a cada capital.
- **Modelos del curso:** Lote Económico de Compra, Revisión Continua, Revisión Periódica y Can-Order, con la misma
  notación (D, S, H = h·c, k, σc, G(k), ROP, NOP, COP, OBS) y los cuatro criterios para k.
- **Simulador:** política por clase ABC, operación, transporte, escenario y costos; un año simulado comparado contra
  una base.
- **Calculadora** con los ejemplos de los apuntes, **actividades** con predicción y **modo juego** de 16 semanas con
  código verificable para comparar grupos.

El plan está en [`docs/plan.md`](docs/plan.md) y la guía para el docente en [`docs/guia-docente.md`](docs/guia-docente.md).

## Desarrollo

```sh
pnpm install
pnpm dev      # servidor de desarrollo
pnpm test     # pruebas del motor de simulación
pnpm build    # sitio estático en dist/
pnpm geo      # vuelve a armar public/geo/uruguay.json desde Overture Maps
```

## Estructura

- `src/sim/`: motor de simulación (catálogo, clientes, demanda, inventario, nave, transporte y costos), fórmulas del
  curso (`course.ts`) y modo juego (`game.ts`).
- `src/didactic/`: actividades de clase.
- `tools/geo/`: mapa de Uruguay y distancias por ruta.
- `src/ui/`: interfaz (estilo Apple, compartido con Logística 3D).
- `src/scene/`: escena 3D.

## Fuentes

- Mapa, rutas y distancias: Overture Maps Foundation, con datos © colaboradores de OpenStreetMap (ODbL).
- Modelos de inventario: unidades del curso de Ingeniería en Logística (UTEC).

Todos los costos y productividades son **estimados**: órdenes de magnitud verosímiles para Uruguay, no datos de
una empresa real.
