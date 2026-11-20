ALTER TABLE mesas ADD COLUMN id_mesa_principal BIGINT REFERENCES mesas(id_mesa);
ALTER TABLE mesas ADD CONSTRAINT chk_mesa_principal_distinta
    CHECK (id_mesa_principal IS NULL OR id_mesa_principal <> id_mesa);
CREATE INDEX idx_mesas_mesa_principal ON mesas(id_mesa_principal);

ALTER TABLE pedidos DROP CONSTRAINT fk_pedidos_cobro_mesa;
ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_cobro
    FOREIGN KEY (id_cobro) REFERENCES cobros_mesa(id_cobro);

-- Recupera las 20 mesas del setup original y conserva los QR de las existentes.
INSERT INTO mesas (numero)
SELECT origen.numero FROM (VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12), (13), (14), (15), (16), (17), (18), (19), (20)) AS origen(numero)
WHERE NOT EXISTS (SELECT 1 FROM mesas m WHERE m.numero = origen.numero);
