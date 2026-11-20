CREATE TABLE mesas (
    id_mesa BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero INTEGER NOT NULL UNIQUE CHECK (numero > 0),
    token_qr UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    activa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE pedidos (
    id_pedido BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_mesa BIGINT NOT NULL REFERENCES mesas(id_mesa),
    id_solicitud UUID NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'RECIBIDO'
        CHECK (estado IN ('RECIBIDO', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'CANCELADO')),
    total NUMERIC(12, 2) NOT NULL CHECK (total > 0),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id_mesa, id_solicitud)
);

CREATE TABLE detalles_pedido (
    id_pedido BIGINT NOT NULL REFERENCES pedidos(id_pedido),
    id_plato BIGINT NOT NULL REFERENCES platos(id_plato),
    nombre_plato VARCHAR(100) NOT NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 7),
    precio_unitario NUMERIC(10, 2) NOT NULL CHECK (precio_unitario > 0),
    PRIMARY KEY (id_pedido, id_plato)
);