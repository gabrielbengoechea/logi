# Centro Logístico 3D · Plan

Simulador 3D de un centro de distribución en Uruguay para clases universitarias de logística. Se trabaja la
cadena completa con transporte terrestre: proveedores → nave → clientes en las capitales departamentales. El
valor didáctico está en el simulador: cambiar la demanda, las políticas, los costos o los recursos, y ver qué
pasa con el inventario, la operación, el transporte y la plata.

## Decisiones tomadas

| Tema | Decisión |
| --- | --- |
| Forma | App aparte de Logística 3D. Mismo estilo de interfaz (Apple) y el mismo nivel de detalle en 3D. Solo tecnología web. |
| Qué se aprende | Gestión de inventario, costos, operación de la nave y la cadena completa con transporte terrestre. |
| Productos | Catálogo grande (unos 240 productos en 8 familias), mercadería genérica en pallets. |
| Modos | **Juego por turnos**: cada semana el estudiante decide y ve el resultado. **Simulador de políticas**: se fijan reglas y se compara contra una base. |
| Mapa | Uruguay real: la nave sobre la Ruta 5, zona oeste de Montevideo; clientes en las capitales departamentales, camiones por las rutas nacionales. |
| Público | Universidad, carreras de logística. Se usan fórmulas (lote económico, punto de pedido, stock de seguridad). |
| Costos | En dólares, con órdenes de magnitud verosímiles para Uruguay. Todos marcados como **estimados**. |
| Nave | Mediana, unos 10.000 m²: alrededor de 6.000 posiciones de pallet, 10 andenes y 6 autoelevadores. |
| Competencia | Todos los grupos juegan la misma demanda (misma semilla). Al final, cada grupo obtiene un código con sus decisiones; el docente lo pega en la app, que vuelve a correr el juego y arma la tabla. Sin servidor. |
| Repositorio | `sr-sebastian/logi`, público, publicado en GitHub Pages. |

Se mantiene lo acordado para Logística 3D: nada de Python, sin datos operativos reales por ahora (pero con la
puerta abierta para sumarlos) y la realidad aumentada o virtual al final.

## El modelo

Paso diario. Dentro del día, la escena 3D reparte los movimientos por hora para animarlos.

### Catálogo

- 8 familias: bebidas, almacén, limpieza, higiene personal, bazar, ferretería, pequeños electrodomésticos y
  juguetes.
- Cada producto tiene:
  - unidades por pallet, costo y precio de venta;
  - demanda media y variabilidad;
  - estacionalidad según la familia (bebidas en verano, juguetes en diciembre y Reyes);
  - proveedor local (3 a 7 días de demora) o importado por el puerto de Montevideo (35 a 50 días).
- La demanda sigue una ley de Pareto: pocos productos venden mucho. De ahí sale la clasificación ABC.
- Se genera con semilla: el mismo número da el mismo catálogo.

### Demanda

- Cada capital departamental es un cliente, con un peso según su población.
- Maldonado y Rocha crecen en verano.
- La demanda diaria es aleatoria alrededor de la media, con efecto del día de la semana.
- Lo que no hay en stock se pierde como venta (opción: queda pendiente).

### Inventario

Las políticas se fijan por clase ABC; con 240 productos no se decide uno por uno. Las opciones:

- **Punto de pedido y lote** (s, Q):
  - punto de pedido = demanda durante la demora + stock de seguridad;
  - stock de seguridad = z × σ × √demora;
  - lote = lote económico (EOQ) o días de cobertura.
- **Revisión periódica** (R, S): cada R días se pide hasta llegar a S.

Además:

- El nivel de servicio objetivo define z.
- En el juego se puede pasar por encima de la regla con pedidos manuales para productos puntuales.

### Nave

- **Capacidad física:** posiciones de pallet en estanterías. Lo que no entra va a un depósito externo, más caro.
- **Capacidad de trabajo:** personal por turno × turnos × productividad, separada en recepción, picking y
  carga. Lo que no se llega a hacer en el día queda atrasado y demora las entregas.
- **Recursos:** andenes y autoelevadores.

### Transporte

- Flota propia (costo fijo mensual más costo por km) o fletes contratados (solo costo por km, más caro).
- Camión con semirremolque: 26 pallets.
- Cada cliente recibe entregas en ciertos días de la semana; la frecuencia es una decisión.
- Las distancias son por ruta desde la nave. En H1 se usan aproximadas; en H3 salen de la red vial real.

### Costos (USD, estimados)

| Concepto | Valor inicial |
| --- | --- |
| Alquiler de la nave | 6 USD por m² por mes |
| Costo de capital del inventario | 12 % anual del valor en stock |
| Depósito externo | 0,60 USD por pallet por día |
| Emitir una orden de compra | 60 USD local, 250 USD importada |
| Operario | 1.600 USD por mes con cargas sociales. Hora extra al doble; turno nocturno más caro. |
| Autoelevador | 1.200 USD por mes cada uno |
| Camión propio | 4.500 USD por mes (amortización, seguro, chofer) más 0,90 USD por km |
| Flete contratado | 1,60 USD por km recorrido, ida y vuelta |
| Venta perdida | El margen que no se cobró, más una penalización por cliente insatisfecho |

### Indicadores

- Nivel de servicio (unidades entregadas sobre pedidas) y pedidos completos y a tiempo (OTIF).
- Días de inventario, rotación y ocupación de la nave.
- Atraso de la operación.
- Costo total por rubro, margen y resultado.
- Kilómetros recorridos y llenado de los camiones.

## Avance

- H0 a H5 listos: motor, nave 3D, mapa de entregas, modo juego, simulador, calculadora, actividades y guía docente
  (`docs/guia-docente.md`).
- Los modelos de inventario siguen las unidades del curso (EOQ, revisión continua, revisión periódica y can-order,
  con los cuatro criterios para k). Las pruebas reproducen los ejemplos de los apuntes (`src/sim/course.test.ts`).
- Las distancias a los clientes salen de la red vial real (`pnpm geo`).
- Pendiente: validar costos y productividades con alguien del rubro; probar en el aula con la pantalla táctil;
  publicar en GitHub Pages (hay que activarlo en el repositorio).

## Hitos

| Hito | Contenido |
| --- | --- |
| H0 | Base del proyecto, interfaz estilo Apple, este plan. |
| H1 | Motor de simulación: catálogo, demanda, inventario, nave, transporte y costos, con pruebas. |
| H2 | Nave 3D detallada: estanterías con pallets según el stock, andenes con camiones, autoelevadores, oficinas, patio de maniobras. |
| H3 | Mapa de Uruguay: rutas reales, ciudades cliente y camiones en viaje. Distancias desde la red vial. |
| H4 | Modo juego: turnos semanales, decisiones, eventos (paro, promoción, demora en el puerto, suba del gasoil), código de resultado y comparación de grupos. |
| H5 | Modo simulador: escenarios, comparación contra la base, actividades con predicción, guía docente. |
| H6 | Ajustes para pantalla táctil y proyector, publicación. |
| Después | Datos reales, si aparecen; realidad aumentada o virtual. |

## Supuestos a revisar

- Todos los costos y productividades son estimados. Hay que validarlos con alguien del rubro.
- La nave y su ubicación son inventadas sobre un predio verosímil junto a la Ruta 5.
- El catálogo es genérico. No representa a ninguna empresa.
