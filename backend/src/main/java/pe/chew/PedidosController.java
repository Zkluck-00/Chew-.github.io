package pe.chew;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/pedidos")
public class PedidosController {
    private final JdbcClient jdbc;

    private final MesasService mesas;
    private final PersonalService personal;

    public PedidosController(JdbcClient jdbc, MesasService mesas, PersonalService personal) {
        this.jdbc = jdbc;
        this.mesas = mesas;
        this.personal = personal;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Recibo registrar(@Valid @RequestBody Solicitud solicitud) {
        mesas.bloquear();
        long mesa = jdbc.sql("""
                SELECT id_mesa FROM mesas
                WHERE numero = :numero AND token_qr = :token AND activa
                FOR UPDATE
                """).param("numero", solicitud.mesa()).param("token", solicitud.token())
                .query(Long.class).optional()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "QR de mesa inválido"));

        return registrarPedido(mesa, solicitud.idSolicitud(), solicitud.items());
    }

    @PostMapping("/manual")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Recibo registrarManual(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @Valid @RequestBody SolicitudManual solicitud) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        mesas.bloquear();
        return registrarPedido(mesas.idActiva(solicitud.mesa()), solicitud.idSolicitud(), solicitud.items());
    }

    private Recibo registrarPedido(long mesa, UUID idSolicitud, List<Item> items) {
        var anterior = buscarRecibo(mesa, idSolicitud);
        if (anterior.isPresent())
            return anterior.get();

        if (items.stream().mapToInt(Item::cantidad).sum() > 7)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Máximo siete unidades por pedido");

        var ids = items.stream().map(Item::idPlato).distinct().toList();
        var platos = new HashMap<Long, Plato>();
        jdbc.sql("""
                SELECT id_plato, nombre, precio, opciones_preparacion FROM platos
                WHERE activo AND id_plato IN (:ids)
                """).param("ids", ids).query(Plato.class).list()
                .forEach(plato -> platos.put(plato.idPlato(), plato));
        if (platos.size() != ids.size())
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Hay platos que ya no están disponibles");

        var detalles = new LinkedHashMap<Detalle, Integer>();
        for (Item item : items) {
            Plato plato = platos.get(item.idPlato());
            String opciones = OpcionesPreparacion.validar(item.opciones(), plato.opcionesPreparacion());
            var detalle = new Detalle(plato, opciones);
            if (detalles.put(detalle, item.cantidad()) != null)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El pedido repite la misma presentación y opciones");
        }
        BigDecimal total = detalles.entrySet().stream()
                .map(detalle -> detalle.getKey().plato().precio().multiply(BigDecimal.valueOf(detalle.getValue())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        var nuevo = jdbc.sql("""
                INSERT INTO pedidos (id_mesa, id_solicitud, total)
                VALUES (:mesa, :solicitud, :total)
                ON CONFLICT (id_mesa, id_solicitud) DO NOTHING
                RETURNING id_pedido, total
                """).param("mesa", mesa)
                .param("solicitud", idSolicitud).param("total", total)
                .query((fila, numero) -> new Recibo(
                        fila.getLong("id_pedido"), fila.getBigDecimal("total")))
                .optional();

        if (nuevo.isEmpty())
            return buscarRecibo(mesa, idSolicitud).orElseThrow();

        Recibo recibo = nuevo.get();
        for (var linea : detalles.entrySet()) {
            var detalle = linea.getKey();
            Plato plato = detalle.plato();
            jdbc.sql("""
                    INSERT INTO detalles_pedido
                        (id_pedido, id_plato, nombre_plato, cantidad, precio_unitario, opciones_preparacion)
                    VALUES (:pedido, :plato, :nombre, :cantidad, :precio, :opciones)
                    """).param("pedido", recibo.idPedido()).param("plato", plato.idPlato())
                    .param("nombre", plato.nombre()).param("cantidad", linea.getValue())
                    .param("precio", plato.precio()).param("opciones", detalle.opciones()).update();
        }
        return recibo;
    }

    private Optional<Recibo> buscarRecibo(long mesa, UUID solicitud) {
        return jdbc.sql("""
                SELECT id_pedido, total FROM pedidos
                WHERE id_mesa = :mesa AND id_solicitud = :solicitud
                """).param("mesa", mesa).param("solicitud", solicitud)
                .query((fila, numero) -> new Recibo(
                        fila.getLong("id_pedido"), fila.getBigDecimal("total")))
                .optional();
    }

    public record Solicitud(@NotNull @Positive Integer mesa, @NotNull UUID token,
            @NotNull UUID idSolicitud,
            @NotEmpty @Size(max = 7) List<@NotNull @Valid Item> items) {
    }

    public record SolicitudManual(@NotNull @Positive Integer mesa, @NotNull UUID idSolicitud,
            @NotEmpty @Size(max = 7) List<@NotNull @Valid Item> items) {}

    public record Item(@NotNull @Positive Long idPlato, @NotNull @Min(1) @Max(7) Integer cantidad,
            @Size(max = 2) List<@NotBlank @Size(max = 70) String> opciones) {}

    public record Recibo(long idPedido, BigDecimal total) {
    }

    private record Plato(long idPlato, String nombre, BigDecimal precio, String opcionesPreparacion) {}
    private record Detalle(Plato plato, String opciones) {}
}
