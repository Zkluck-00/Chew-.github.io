CREATE TABLE cobros_mesa (
    id_cobro BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_mesa BIGINT NOT NULL REFERENCES mesas(id_mesa),
    id_solicitud UUID NOT NULL,
    metodo VARCHAR(10) NOT NULL CHECK (metodo IN ('EFECTIVO', 'TARJETA', 'YAPE')),
    total NUMERIC(16, 2) NOT NULL CHECK (total > 0),
    cobrado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_mesa, id_solicitud),
    UNIQUE (id_cobro, id_mesa)
);

ALTER TABLE pedidos ADD COLUMN id_cobro BIGINT;
ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_cobro_mesa
    FOREIGN KEY (id_cobro, id_mesa) REFERENCES cobros_mesa (id_cobro, id_mesa);
ALTER TABLE pedidos ADD CONSTRAINT chk_pedido_cobrado_entregado
    CHECK (id_cobro IS NULL OR estado = 'ENTREGADO');

CREATE INDEX idx_pedidos_id_cobro ON pedidos (id_cobro);
