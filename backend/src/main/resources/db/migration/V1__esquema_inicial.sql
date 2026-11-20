CREATE TABLE platos (
    id_plato BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo_plato VARCHAR(40) NOT NULL UNIQUE CHECK (btrim(codigo_plato) <> ''),
    nombre VARCHAR(100) NOT NULL CHECK (btrim(nombre) <> ''),
    descripcion VARCHAR(500),
    precio NUMERIC(10, 2) NOT NULL CHECK (precio > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);