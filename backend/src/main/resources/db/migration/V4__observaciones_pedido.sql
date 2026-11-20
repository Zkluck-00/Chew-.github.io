-- Agrega campo opcional para notas y observaciones de preparación de platos en cocina
ALTER TABLE detalles_pedido ADD COLUMN IF NOT EXISTS observacion VARCHAR(255) DEFAULT '';
