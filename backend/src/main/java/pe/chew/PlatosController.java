package pe.chew;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlatosController {
    private final JdbcClient jdbc;

    public PlatosController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/platos/activos")
    public List<Plato> listarActivos() {
        return jdbc.sql("""
                SELECT id_plato, nombre, precio
                FROM platos
                WHERE activo
                ORDER BY nombre, id_plato
                """)
                .query((fila, numero) -> new Plato(
                        fila.getLong("id_plato"),
                        fila.getString("nombre"),
                        fila.getBigDecimal("precio")))
                .list();
    }

    public record Plato(long idPlato, String nombre, BigDecimal precio) {
    }
}