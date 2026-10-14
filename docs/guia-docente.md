# Guía docente

Centro Logístico 3D simula un centro de distribución de 10.000 m² sobre la Ruta 5 (Montevideo). Abastece a las 19
capitales departamentales, con Montevideo dividida en dos zonas. Todo funciona en el navegador, sin instalar nada.

Qué es real y qué es simulado:

- **Real:** el mapa de Uruguay, las rutas nacionales y las distancias por ruta a cada capital (Overture Maps /
  OpenStreetMap).
- **Simulado:** la nave, el catálogo (240 productos genéricos), la demanda, los costos y las productividades. Los
  costos son estimados, en dólares, con órdenes de magnitud verosímiles para Uruguay. No son datos de una empresa.

El valor didáctico está en **cambiar una cosa y ver qué pasa en toda la cadena**: inventario, operación de la nave,
transporte y resultado.

## Los modelos del curso en la app

El motor usa las fórmulas y la notación de las unidades del curso (`src/sim/course.ts`). Las pruebas automáticas
reproducen los ejemplos de los apuntes:

- EOQ: Q* = 400, CT = $5.000.
- Revisión periódica: σc = 124,12, SS = 204,2 y NOP = 531 en el ejemplo 1; σc = 102,8, SS = 169,1 y NOP = 393 en el
  ejemplo 2.
- Lead time del arroz: LT = 36,3 días, σLT = 3,63.
- Tabla normal: Φ(k) y G(k).
- Can-order: el ejemplo de tres artículos da 210, 140 y 0.

| Modelo | Política | Fórmulas |
| --- | --- | --- |
| Lote Económico de Compra | Pedir Q* | Q* = √(2·D·S/H), H = h·c, TRC = S·D/Q + H·Q/2 |
| Revisión Continua | Pedir Q cuando la posición cae al ROP | ROP = d·LT + k·σc, σc = √(σd²·LT + d²·σLT²), SS = k·σc |
| Revisión Periódica | Cada R días, pedir hasta el NOP | NOP = d·(LT + R) + k·σc, σc = √(σd²·(LT + R) + d²·σLT²) |
| Can-Order | Si uno baja del ROP se emite la orden; se suman los que están bajo su COP; cada uno pide hasta OBS | COP = ROP + d·S_ahorrado/(H_t·Q), OBS = ROP + Q |

El factor k se elige con los cuatro criterios del curso:

- NSC: k = DISTR.NORM.ESTAND.INV(NSC).
- Fill rate: G(k) = (1 − FR)·Q/σc.
- Costo por unidad perdida: c_up.
- Costo por venta no realizada: B.

En el simulador, c_up de cada producto es su margen más una penalización por cliente insatisfecho.

Diferencias con los apuntes, para aclarar en clase:

- **H incluye el espacio:** en la app, H = h·c más el alquiler del lugar que ocupa cada unidad. Se puede apagar en
  *Simulador → Costos*. Sin el espacio, el lote económico de productos baratos y voluminosos (agua, refrescos) sale
  enorme y no entra en la nave.
- **Costo de faltantes en revisión continua:** el apunte lo escribe c_up·Q²·(1 − FR). La app usa
  c_up·σc·G(k)·D/Q (unidades perdidas por año), igual que en revisión periódica. Conviene revisarlo con el equipo
  docente.
- **El pronóstico se actualiza:** d y σd salen de un suavizado exponencial de los pedidos de los clientes (se usa
  aproximadamente el último mes). Por eso la política se adapta, con atraso, a la temporada.

## Antes de la clase

- Abrí la app en la computadora del proyector. Si va lenta, bajá la calidad en **Ajustes** (botón **⋯**).
- **Presentar** (primer botón de arriba a la derecha) agranda la interfaz y pasa a pantalla completa.
- Las vistas de arriba muestran la nave por dentro (**Nave**, **Andenes**, **Planta**), el predio (**Exterior**) y el
  **Mapa** de entregas.
- Tocando un pallet se abre la ficha del producto: su clase ABC, cómo varió su stock en el año y su política del día
  con los números (d, σd, LT, σLT, σc, k, SS, ROP o NOP, Q*).

## Calculadora del curso (10 minutos)

En **Explorar → Calculadora del curso** están los cuatro modelos, cargados con los ejemplos de los apuntes. Sirve
para hacer los ejercicios en el pizarrón y cambiar un dato frente a la clase. Por ejemplo, mostrar la sensibilidad
del EOQ: pedir 25 % más que Q* cuesta solo 2,5 % más.

## Actividades (15 minutos cada una)

Están en **Explorar → Actividades**. Todas siguen el mismo esquema:

1. Leer el contexto.
2. Cada grupo elige una predicción.
3. Se simula un año con el cambio y otro con la operación normal.
4. La app muestra la respuesta, que sale de la simulación, con los números y preguntas para discutir.

Al terminar, la comparación queda armada en el **Simulador**.

Las pruebas automáticas verifican que la conclusión es la misma con tres demandas distintas. Los valores de abajo son
los de la partida por defecto.

| # | Actividad | Unidad | Cambio | Respuesta | Valores de referencia |
| --- | --- | --- | --- | --- | --- |
| 1 | Pedir más barato | EOQ | S: de 60 a 15 USD (local) y de 250 a 60 USD (importación) | Más órdenes y menos stock | Órdenes: 4.656 → 5.440. Stock: USD 5,30 M → 4,60 M |
| 2 | Del 95 % al 99,5 % | Revisión continua | NSC 99,5 % en todas las clases | El stock crece mucho más que el servicio | Fill rate: 97,7 % → 98,7 %. Stock: +17 % |
| 3 | Revisar cada dos semanas | Revisión periódica | Todo a revisión periódica, R = 14 días | Sube el stock (protege LT + R) | Stock: USD 5,30 M → 6,45 M |
| 4 | Pedir junto con el mismo proveedor | Can-order | Todo a can-order | Muchas menos órdenes y menor costo de pedir | Órdenes: 4.656 → 1.194. Costo de pedir: USD 591 mil → 205 mil |
| 5 | El puerto se atrasa | Revisión continua (lead time) | Importados: demora +50 % | Baja el fill rate aunque sube el stock | Fill rate: 97,7 % → 97,2 %. Stock: USD 5,30 M → 6,23 M |

Errores comunes que conviene discutir:

- **Actividad 1:** creer que con S cuatro veces menor las órdenes se cuadruplican. Q* depende de la raíz de S, la
  clase C está en revisión periódica y una orden agrupa varios productos del mismo proveedor.
- **Actividad 2:** creer que el stock crece en la misma proporción que el servicio. Es cuasi exponencial.
- **Actividad 3:** creer que pedir menos seguido baja el stock.
- **Actividad 5:** creer que el ROP "se acomoda solo". Los pedidos que ya estaban en camino y la mayor variación
  dejan faltantes durante la transición.

## Modo juego (una clase entera)

En **Explorar → Modo juego**, cada grupo maneja el centro logístico 16 semanas, del 6 de setiembre al 26 de
diciembre: la subida de demanda de fin de año está incluida. Cada semana deciden:

- la política de cada clase: modelo, criterio para k, lote o R;
- la operación: turnos, operarios, autoelevadores y horas extra;
- el transporte: camiones propios y frecuencia de entrega.

Después juegan la semana y ven el informe. Hay cuatro imprevistos por partida, anunciados la semana en que ocurren:
paro de transporte, congestión en el puerto, promoción de bebidas, suba del gasoil, ola de calor o brote de gripe.

- Todos los grupos con el **mismo número de partida** tienen la misma demanda y los mismos imprevistos.
- Gana el mayor **resultado**: margen bruto menos costos logísticos. Las ventas perdidas ya restan, porque no se
  cobran.
- Al terminar, cada grupo copia su **código** y te lo manda.
- En **Comparar grupos**, pegás los códigos y la app vuelve a jugar cada partida con sus decisiones, verifica el
  resultado y arma la tabla de posiciones.

## Simulador libre

En **Explorar → Simulador** se cambia cualquier cosa, se simula un año completo y se compara contra la base:

- políticas por clase, operación y transporte;
- escenario: demanda, variabilidad, estacionalidad, demora de importados, gasoil y si los faltantes se pierden o
  quedan pendientes;
- costos: h, S y el espacio en H.

Resultados que muestra:

- fill rate y NSC medido por clase;
- pedidos a tiempo, ventas perdidas, stock promedio, ocupación de la nave y días sin lugar;
- órdenes de compra;
- costos por rubro y resultado.

Consignas abiertas que funcionan bien:

- *"Con la temporada alta, ¿qué combinación de modelos por clase da el mejor resultado?"*
- *"¿Conviene tener más camiones propios o contratar fletes?"*
- *"¿Qué pasa con el fill rate medido de cada clase si el criterio pasa de NSC a fill rate?"*

## Límites del modelo (para no enseñar de más)

- La operación es simulada y genérica. No reproduce ninguna empresa real ni sus números.
- La demanda de cada producto es estacionaria salvo por la estacionalidad de su familia. El pronóstico (suavizado
  exponencial) llega tarde a la temporada alta: en octubre y noviembre el servicio baja. Es material de clase.
- Los viajes son directos de la nave a cada capital (sin repartos encadenados).
- Los autoelevadores, los camiones en los andenes y los pallets en la playa son ilustrativos.
- La ocupación de la nave por producto se muestra con ubicaciones fijas según la rotación más una reserva. Lo que no
  entra va a depósito externo, que se paga.
