CREATE TABLE personal (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario VARCHAR(80) NOT NULL UNIQUE,
    clave_hash VARCHAR(100) NOT NULL,
    rol VARCHAR(10) NOT NULL CHECK (rol IN ('ADMIN', 'COCINA', 'MESERO')),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE sesiones_personal (
    token_hash VARCHAR(64) PRIMARY KEY,
    id_personal BIGINT NOT NULL REFERENCES personal(id),
    expira_en TIMESTAMPTZ NOT NULL
);

CREATE INDEX sesiones_personal_empleado ON sesiones_personal(id_personal);
