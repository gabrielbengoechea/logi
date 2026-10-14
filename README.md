# Centro Logístico 3D

Simulador 3D de un centro de distribución sobre la Ruta 5 (Montevideo, Uruguay) para clases universitarias de
logística: gestión de inventario, costos, operación de la nave y transporte terrestre a las capitales
departamentales. Tiene modo juego (decisiones semana a semana, con competencia entre grupos) y modo simulador.

El plan, las decisiones y los supuestos están en [`docs/plan.md`](docs/plan.md).

## Desarrollo

```sh
pnpm install
pnpm dev      # servidor de desarrollo
pnpm test     # pruebas del motor de simulación
pnpm build    # sitio estático en dist/
```

## Estructura

- `src/sim/`: motor de simulación (catálogo, clientes, demanda, inventario, nave, transporte y costos).
- `src/ui/`: interfaz (estilo Apple, compartido con Logística 3D).
- `src/scene/`: escena 3D.

Todos los costos y productividades son **estimados**: órdenes de magnitud verosímiles para Uruguay, no datos de
una empresa real.
