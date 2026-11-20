package pe.chew;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MesasService {
    private final JdbcClient jdbc;

    public MesasService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Mesa> listar() {
        return jdbc.sql("""
                SELECT m.numero, principal.numero AS principal, EXISTS (
                    SELECT 1 FROM pedidos p JOIN mesas origen ON origen.id_mesa = p.id_mesa
                    WHERE COALESCE(origen.id_mesa_principal, origen.id_mesa) = principal.id_mesa
                      AND p.id_cobro IS NULL AND p.estado <> 'CANCELADO'
                ) AS ocupada
                FROM mesas m JOIN mesas principal ON principal.id_mesa = COALESCE(m.id_mesa_principal, m.id_mesa)
                WHERE m.activa ORDER BY m.numero
                """).query(Mesa.class).list();
    }

    public List<CodigoMesa> codigos() {
        return jdbc.sql("SELECT numero, token_qr AS token FROM mesas WHERE activa ORDER BY numero")
                .query(CodigoMesa.class).list();
    }

    // El mismo orden de bloqueo coordina pedidos, cambios de grupo y cobros.
    public void bloquear() {
        jdbc.sql("SELECT id_mesa FROM mesas ORDER BY id_mesa FOR UPDATE").query(Long.class).list();
    }

    @Transactional
    public void unir(int destino, int origen) {
        bloquear();
        long principal = principal(destino);
        long secundaria = principal(origen);
        if (principal == secundaria)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Estas mesas ya están unidas");
        jdbc.sql("""
                UPDATE mesas SET id_mesa_principal = :principal
                WHERE id_mesa = :secundaria OR id_mesa_principal = :secundaria
                """).param("principal", principal).param("secundaria", secundaria).update();
    }

    @Transactional
    public void separar(int numero) {
        bloquear();
        long principal = principal(numero);
        boolean ocupada = listar().stream().anyMatch(mesa -> mesa.numero() == numero && mesa.ocupada());
        if (ocupada) throw new ResponseStatusException(HttpStatus.CONFLICT, "Cobra la cuenta antes de separar las mesas");
        jdbc.sql("UPDATE mesas SET id_mesa_principal = NULL WHERE id_mesa_principal = :principal")
                .param("principal", principal).update();
    }

    public long idActiva(int numero) {
        return jdbc.sql("SELECT id_mesa FROM mesas WHERE numero = :numero AND activa")
                .param("numero", numero).query(Long.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa inexistente o inactiva"));
    }

    private long principal(int numero) {
        return jdbc.sql("SELECT COALESCE(id_mesa_principal,id_mesa) FROM mesas WHERE numero=:numero AND activa")
                .param("numero", numero).query(Long.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa inexistente o inactiva"));
    }

    public record CodigoMesa(int numero, UUID token) {}

    public record Mesa(int numero, int principal, boolean ocupada) {}
}
