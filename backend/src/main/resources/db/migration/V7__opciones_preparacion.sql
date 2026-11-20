ALTER TABLE platos ADD COLUMN opciones_preparacion VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE detalles_pedido ADD COLUMN opciones_preparacion VARCHAR(160) NOT NULL DEFAULT '';
ALTER TABLE detalles_pedido DROP CONSTRAINT detalles_pedido_pkey;
ALTER TABLE detalles_pedido ADD PRIMARY KEY (id_pedido, id_plato, opciones_preparacion);

-- Opciones del catálogo original Chew (Frontend/js/platos.js), por grupo de presentaciones.
UPDATE platos SET opciones_preparacion = 'Con ají' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('cev-001', 'cev-002', 'cev-003', 'cev-004', 'cev-005', 'cev-006', 'cev-007', 'cev-008', 'cev-009', 'cev-010', 'cev-011', 'cev-012', 'cev-013', 'cev-014', 'cev-016', 'cev-017', 'cev-018', 'duo-001', 'duo-002', 'duo-003', 'duo-004', 'duo-005', 'duo-006');
UPDATE platos SET opciones_preparacion = 'Preparación normal' WHERE grupo_catalogo IN ('cev-015', 'ron-001', 'ent-003');
UPDATE platos SET opciones_preparacion = 'Sin crema, solo limón' || CHR(10) || 'Con ají' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('tir-001');
UPDATE platos SET opciones_preparacion = 'Bajo en crema de ají amarillo' || CHR(10) || 'Con ají' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('tir-002');
UPDATE platos SET opciones_preparacion = 'Poco picante' || CHR(10) || 'Muy picante' WHERE grupo_catalogo IN ('tir-003');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Sin sillao' || CHR(10) || 'Sin jengibre' || CHR(10) || 'Sin ajonjolí' WHERE grupo_catalogo IN ('tir-004');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Separar las cremas' || CHR(10) || 'Con ají' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('tir-005');
UPDATE platos SET opciones_preparacion = 'Con ají' || CHR(10) || 'Sin ají' || CHR(10) || 'Sin cebolla' || CHR(10) || 'Sin brocheta de chicharrón' WHERE grupo_catalogo IN ('lec-001');
UPDATE platos SET opciones_preparacion = 'Con ají' || CHR(10) || 'Sin ají' || CHR(10) || 'Sin mariscos crocantes' || CHR(10) || 'Bajo en pasta de ají escabeche' WHERE grupo_catalogo IN ('lec-002');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Sin ají' || CHR(10) || 'Sin cebolla' WHERE grupo_catalogo IN ('cau-001');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Salsa aparte' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('cau-002', 'cau-005');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Crema aparte' || CHR(10) || 'Sin aceituna' WHERE grupo_catalogo IN ('cau-003');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Crocante aparte' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('cau-004');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Sin mayonesa' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('cau-006');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Salsas aparte' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('cau-007');
UPDATE platos SET opciones_preparacion = 'Preparación normal' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('ron-002', 'ron-003');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Bien crocante' || CHR(10) || 'Salsa aparte' WHERE grupo_catalogo IN ('chi-001', 'chi-002', 'chi-003', 'chi-004', 'chi-005', 'chi-006', 'chi-007', 'jal-001', 'jal-002', 'jal-003');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Poco picante' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('sud-001', 'sud-002', 'sud-003', 'sud-004', 'sud-005', 'sud-006', 'sud-007', 'sud-008', 'sud-009', 'sud-010');
UPDATE platos SET opciones_preparacion = 'Lomo' || CHR(10) || 'Queso' || CHR(10) || 'Jamón' || CHR(10) || 'Pollo' WHERE grupo_catalogo IN ('ent-001');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Salsa aparte' || CHR(10) || 'Sin aceituna' WHERE grupo_catalogo IN ('ent-002');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Crema aparte' || CHR(10) || 'Sin ají' WHERE grupo_catalogo IN ('ent-004', 'ent-005');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Sin ají' || CHR(10) || 'Sin culantro' WHERE grupo_catalogo IN ('arr-001', 'arr-004');
UPDATE platos SET opciones_preparacion = 'Marisco' || CHR(10) || 'Carne' || CHR(10) || 'Pollo' WHERE grupo_catalogo IN ('arr-002');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Sin cebolla china' || CHR(10) || 'Sin sillao' WHERE grupo_catalogo IN ('arr-003');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Sin sillao' || CHR(10) || 'Sin cebolla china' WHERE grupo_catalogo IN ('arr-005');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Término medio' || CHR(10) || 'Bien cocido' WHERE grupo_catalogo IN ('esp-001', 'esp-006', 'par-001', 'par-002');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Salsa aparte' || CHR(10) || 'Sin queso' WHERE grupo_catalogo IN ('esp-002');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Sin ensalada' || CHR(10) || 'Papas aparte' WHERE grupo_catalogo IN ('esp-003');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Bien crocante' || CHR(10) || 'Papas aparte' WHERE grupo_catalogo IN ('esp-004');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Sin cebolla' || CHR(10) || 'Papas aparte' WHERE grupo_catalogo IN ('esp-005');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Salsa aparte' || CHR(10) || 'Bien dorado' WHERE grupo_catalogo IN ('esp-007');
UPDATE platos SET opciones_preparacion = 'Normal' || CHR(10) || 'Sin ají' || CHR(10) || 'Salsa aparte' WHERE grupo_catalogo IN ('esp-008', 'par-004');
UPDATE platos SET opciones_preparacion = 'Chuleta' || CHR(10) || 'Churrasco' || CHR(10) || 'Bien cocido' WHERE grupo_catalogo IN ('par-003');
UPDATE platos SET opciones_preparacion = 'Sin azúcar' || CHR(10) || 'Normal' || CHR(10) || 'Helada' WHERE grupo_catalogo IN ('beb-001', 'beb-003', 'beb-004', 'beb-005', 'beb-006', 'beb-007', 'beb-008', 'beb-009');
UPDATE platos SET opciones_preparacion = 'Sin azúcar' || CHR(10) || 'Regular azúcar' || CHR(10) || 'Helada' || CHR(10) || 'Sin helar' || CHR(10) || 'Con hielo aparte' WHERE grupo_catalogo IN ('beb-002');
UPDATE platos SET opciones_preparacion = 'Helada' || CHR(10) || 'Sin helar' WHERE grupo_catalogo IN ('gas-001', 'gas-002', 'gas-003');
UPDATE platos SET opciones_preparacion = 'Helada' || CHR(10) || 'Sin helar' || CHR(10) || 'Con hielo aparte' WHERE grupo_catalogo IN ('gas-004');

-- Las bebidas del catálogo permiten elegir temperatura junto con su preparación original.
UPDATE platos SET opciones_preparacion = opciones_preparacion || CHR(10) || 'Sin helar'
WHERE grupo_catalogo IS NOT NULL AND categoria IN ('Bebidas sin alcohol', 'Gaseosas')
  AND opciones_preparacion LIKE '%Helada%' AND opciones_preparacion NOT LIKE '%Sin helar%';

-- Sustituye enlaces inaccesibles del menú original sin pisar las fotos editadas.
-- https://eduardoelbrujotumbes.com/producto/ceviche-clasico/
UPDATE platos SET imagen = 'https://eduardoelbrujotumbes.com/wp-content/uploads/2020/04/ceviche-de-pescado_700x465.jpg'
WHERE grupo_catalogo = 'cev-002' AND imagen = 'https://micevichedehoy.com/assets/images/ceviche-de-pescado_800x534.webp';
-- https://peruvian-sunrise.com/blog/peruvian-guide-nikkei-cuisine
UPDATE platos SET imagen = 'https://peruvian-sunrise.com/sites/default/files/inline-images/tiradito-nikkei-peruvian-food.jpg'
WHERE grupo_catalogo = 'tir-004' AND imagen = 'https://okamisushibar.com/wp-content/uploads/2023/12/TIRADITO-NIKKEI.jpg';
-- https://www.asdeoros.com.pe/cocina-autor-pulpo-olivo.html
UPDATE platos SET imagen = 'https://www.asdeoros.com.pe/images/blog/blog10/1.jpg'
WHERE grupo_catalogo = 'cau-003' AND imagen = 'https://i.ytimg.com/vi/AjSVuWWBdOc/maxresdefault.jpg';
-- https://buenazo.pe/recetas/entradas/chicharron-pescado-receta-169
UPDATE platos SET imagen = 'https://origin.cronosmedia.glr.pe/large/2021/03/31/lg_6064f2c3c12fbd5ddc25be2f.jpg'
WHERE grupo_catalogo = 'chi-003' AND imagen = 'https://i.ytimg.com/vi/qSwHv_Hl6DA/sddefault.jpg';
-- https://cursoscocinaperuana.com/recetas-de-cocina/receta-de-chicharron-de-pollo/
UPDATE platos SET imagen = 'https://cursoscocinaperuana.com/wp-content/uploads/2022/08/Chicharron-de-Pollo.jpg'
WHERE grupo_catalogo = 'chi-004' AND imagen = 'https://i.ytimg.com/vi/CYAUf6A3cSI/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDwg9wDOTNyVoQOQ01W2nPx8uz2JA';
-- https://glotoncubano.com/recetas-de-bebidas-sin-alcohol
UPDATE platos SET imagen = 'https://cdn.glotoncubano.com/posts/post-190/featured/limonada-casera-refrescante-en-vaso-con-rodajas-de-limon-y-hielo.webp'
WHERE grupo_catalogo = 'beb-006' AND imagen = 'https://www.gastrolabweb.com/u/fotografias/m/2021/5/2/f1280x720-12606_144281_5050.jpg';
-- https://www.cocinadelirante.com/recetas/receta-de-agua-de-maracuya-con-mango-super-refrescante-y-dulce
UPDATE platos SET imagen = 'https://www.cocinadelirante.com/sites/default/files/images/2025/05/receta-de-agua-de-maracuya-con-mango.jpg'
WHERE grupo_catalogo = 'beb-008' AND imagen = 'https://i.ytimg.com/vi/1I0MlrojsRY/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBbTThXxB1rZALTDjcdumfu1xq3Sw';
