package pe.chew;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class PlatosController {
    private final JdbcClient jdbc;
    private final PersonalService personal;

    public PlatosController(JdbcClient jdbc, PersonalService personal) {
        this.jdbc = jdbc;
        this.personal = personal;
    }

    @GetMapping("/api/platos/activos")
    public List<Plato> listarActivos() {
        return listar(true);
    }

    @GetMapping("/api/admin/platos")
    public ResponseEntity<List<Plato>> listarTodos(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(listar(false));
    }

    @PostMapping("/api/platos")
    @ResponseStatus(HttpStatus.CREATED)
    public void crear(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @Valid @RequestBody Producto producto) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        guardar("""
                INSERT INTO platos(codigo_plato,nombre,descripcion,categoria,precio,imagen,activo,nombre_carta)
                VALUES (:codigo,:nombre,:descripcion,:categoria,:precio,:imagen,:activo,:titulo)
                """, producto, null);
    }

    @PutMapping("/api/platos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void editar(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @PathVariable long id, @Valid @RequestBody Producto producto) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        Plato original = listarPorId(id);
        if (original.grupoCatalogo() != null) {
            jdbc.sql("""
                    UPDATE platos SET descripcion=:descripcion,categoria=:categoria,imagen=:imagen,nombre_carta=:titulo
                    WHERE grupo_catalogo=:grupo
                    """).param("descripcion", producto.descripcion()).param("categoria", producto.categoria().strip())
                    .param("imagen", imagen(producto.imagen())).param("titulo", titulo(producto))
                    .param("grupo", original.grupoCatalogo()).update();
        }
        guardar("""
                UPDATE platos SET codigo_plato=:codigo,nombre=:nombre,descripcion=:descripcion,
                       categoria=:categoria,precio=:precio,imagen=:imagen,activo=:activo,nombre_carta=:titulo
                WHERE id_plato=:id
                """, producto, id);
    }

    @DeleteMapping("/api/platos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactivar(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @PathVariable long id) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        if (jdbc.sql("UPDATE platos SET activo = FALSE WHERE id_plato = :id").param("id", id).update() == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto inexistente");
    }

    private List<Plato> listar(boolean activos) {
        return jdbc.sql(COLUMNAS + (activos ? " WHERE activo" : "") + " ORDER BY id_plato")
                .query(Plato.class).list();
    }

    private Plato listarPorId(long id) {
        return jdbc.sql(COLUMNAS + " WHERE id_plato=:id").param("id", id).query(Plato.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Producto inexistente"));
    }

    private void guardar(String sql, Producto producto, Long id) {
        try {
            var consulta = jdbc.sql(sql).param("codigo", producto.codigoPlato().strip())
                    .param("nombre", producto.nombre().strip()).param("descripcion", producto.descripcion())
                    .param("categoria", producto.categoria().strip()).param("precio", producto.precio())
                    .param("activo", producto.activo()).param("imagen", imagen(producto.imagen())).param("titulo", titulo(producto));
            if (id != null) consulta.param("id", id);
            consulta.update();
        } catch (DuplicateKeyException falla) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este código ya existe");
        }
    }

    private static String imagen(String valor) {
        if (valor == null || valor.isBlank()) return null;
        try {
            var url = java.net.URI.create(valor.strip());
            if ("https".equalsIgnoreCase(url.getScheme()) && url.getHost() != null && url.getUserInfo() == null)
                return url.toString();
        } catch (IllegalArgumentException falla) {
            // La validación devuelve el mismo error para cualquier URL no válida.
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usa una URL HTTPS válida para la imagen");
    }

    private static String titulo(Producto producto) {
        return producto.nombreCarta() == null || producto.nombreCarta().isBlank()
                ? producto.nombre().strip() : producto.nombreCarta().strip();
    }

    private static final String COLUMNAS = """
            SELECT id_plato, codigo_plato, nombre, descripcion, categoria, precio, imagen,
                   activo, grupo_catalogo, nombre_carta, variante, opciones_preparacion FROM platos
            """;

    public record Plato(long idPlato, String codigoPlato, String nombre, String descripcion, String categoria,
            BigDecimal precio, String imagen, boolean activo, String grupoCatalogo, String nombreCarta, String variante,
            @JsonIgnore String opcionesPreparacion) {
        @JsonProperty("opciones")
        public List<OpcionesPreparacion.Opcion> opciones() {
            return OpcionesPreparacion.catalogo(opcionesPreparacion);
        }
    }

    public record Producto(@NotBlank @Size(max = 40) String codigoPlato, @NotBlank @Size(max = 100) String nombre,
            @Size(max = 100) String nombreCarta, @Size(max = 500) String descripcion,
            @NotBlank @Size(max = 80) String categoria, @NotNull @DecimalMin("0.01")
            @Digits(integer = 8, fraction = 2) BigDecimal precio, @Size(max = 2048) String imagen,
            @NotNull Boolean activo) {}
}
