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


## Recorrido en VR (Meta Quest 2 y 3)

Este fork suma un recorrido a pie en realidad virtual. Publicado en **https://gabrielbengoechea.github.io/logi/**.

1. En el Quest, abrir la dirección en el navegador del visor y tocar **Entrar en VR** (o el ícono del visor arriba a la derecha).
2. Antes de empezar aparece un **tutorial ilustrado** con los controles (como en Mission:ISS). Se avanza con el gatillo.
3. Controles: **stick izquierdo** caminar (click: correr) · **stick derecho** girar 30° y, hacia adelante, arco de **teletransporte** · **gatillo** ficha de lo que se apunta · **Y** volver al punto de partida · **B** ver el tutorial de nuevo.
4. Las mallas son colisionables: paredes, estanterías, contenedores y máquinas no se atraviesan (cápsula contra la geometría real con three-mesh-bvh). Si alguien cae al agua o a un vacío, vuelve a tierra firme.
5. Se empieza sobre el pasillo peatonal de la nave; la vista pasa sola a «Exterior» para que las paredes se vean de los dos lados.

Sin visor: botón **A pie** para recorrer en primera persona con W A S D y el mouse, con las mismas colisiones.

Rendimiento en el Quest 2: 72 Hz, renderizado foveado y, dentro del visor, sin posprocesado ni sombras dinámicas.

Para probar sin visor: `?emular=1` simula un Quest en la computadora y `?debug=1` deja el jugador en `window.__vr`.

El código del recorrido está en `src/vr/` (tutorial, mundo de colisión, jugador, locomoción) y tiene sus pruebas en `fisica.test.ts`.

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
