package pe.chew;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CobrosMesaService {
    private final JdbcClient jdbc;

    private final MesasService mesas;

    public CobrosMesaService(JdbcClient jdbc, MesasService mesas) {
        this.jdbc = jdbc;
        this.mesas = mesas;
    }

    public List<Cuenta> listar() {
        var pedidos = jdbc.sql("""
                SELECT principal.numero, principal.id_mesa, p.id_pedido, p.estado, p.total
                FROM pedidos p JOIN mesas m USING (id_mesa)
                JOIN mesas principal ON principal.id_mesa = COALESCE(m.id_mesa_principal, m.id_mesa)
                WHERE p.id_cobro IS NULL AND p.estado <> 'CANCELADO'
                ORDER BY principal.numero, p.id_pedido
                """).query((fila, numero) -> new PedidoPendiente(fila.getLong("id_mesa"), fila.getInt("numero"),
                        fila.getLong("id_pedido"), fila.getString("estado"), fila.getBigDecimal("total"))).list();

        return pedidos.stream()
                .collect(Collectors.groupingBy(PedidoPendiente::idMesa, LinkedHashMap::new, Collectors.toList()))
                .values().stream()
                .map(grupo -> new Cuenta(grupo.getFirst().idMesa(), grupo.getFirst().mesa(),
                        grupo.stream().map(PedidoPendiente::idPedido).toList(),
                        grupo.stream().filter(pedido -> !"ENTREGADO".equals(pedido.estado())).count(),
                        grupo.stream().map(PedidoPendiente::total).reduce(BigDecimal.ZERO, BigDecimal::add)))
                .toList();
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public Recibo cobrar(long idMesa, Solicitud solicitud) {
        Set<Long> esperados = new HashSet<>(solicitud.idPedidos());
        if (esperados.size() != solicitud.idPedidos().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La solicitud repite pedidos");
        }

        mesas.bloquear();
        int mesa = jdbc.sql("SELECT numero FROM mesas WHERE id_mesa = :mesa FOR UPDATE")
                .param("mesa", idMesa).query(Integer.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Mesa inexistente"));

        var anterior = buscarCobro(idMesa, solicitud.idSolicitud());
        if (anterior.isPresent()) {
            Recibo recibo = recibo(anterior.get(), mesa);
            if (recibo.metodo() != solicitud.metodo() || !esperados.equals(Set.copyOf(recibo.idPedidos()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "La solicitud ya se usó con otros datos");
            }
            return recibo;
        }

        var pedidos = jdbc.sql("""
                SELECT id_pedido, estado, total FROM pedidos
                WHERE id_mesa IN (
                    SELECT id_mesa FROM mesas
                    WHERE COALESCE(id_mesa_principal, id_mesa) = :mesa
                ) AND id_cobro IS NULL AND estado <> 'CANCELADO'
                ORDER BY id_pedido FOR UPDATE
                """).param("mesa", idMesa)
                .query((fila, numero) -> new PedidoPendiente(idMesa, mesa, fila.getLong("id_pedido"),
                        fila.getString("estado"), fila.getBigDecimal("total"))).list();

        var ids = pedidos.stream().map(PedidoPendiente::idPedido).toList();
        if (!esperados.equals(Set.copyOf(ids))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta cambió. Actualiza los pedidos");
        }
        if (pedidos.stream().anyMatch(pedido -> !"ENTREGADO".equals(pedido.estado()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La mesa tiene pedidos pendientes de entrega");
        }

        BigDecimal total = pedidos.stream().map(PedidoPendiente::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        var clave = new GeneratedKeyHolder();
        jdbc.sql("""
                INSERT INTO cobros_mesa (id_mesa, id_solicitud, metodo, total)
                VALUES (:mesa, :solicitud, :metodo, :total)
                """).param("mesa", idMesa).param("solicitud", solicitud.idSolicitud())
                .param("metodo", solicitud.metodo().name()).param("total", total).update(clave, "id_cobro");

        int asociados = jdbc.sql("""
                UPDATE pedidos SET id_cobro = :cobro
                WHERE id_pedido IN (:pedidos) AND id_cobro IS NULL AND estado = 'ENTREGADO'
                """).param("cobro", Objects.requireNonNull(clave.getKey()).longValue())
                .param("pedidos", ids).update();
        if (asociados != ids.size()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La cuenta cambió durante el cobro");
        }

        return recibo(buscarCobro(idMesa, solicitud.idSolicitud()).orElseThrow(), mesa);
    }

    private Optional<Cobro> buscarCobro(long idMesa, UUID idSolicitud) {
        return jdbc.sql("""
                SELECT id_cobro, metodo, total, cobrado_en FROM cobros_mesa
                WHERE id_mesa = :mesa AND id_solicitud = :solicitud
                """).param("mesa", idMesa).param("solicitud", idSolicitud)
                .query((fila, numero) -> new Cobro(fila.getLong("id_cobro"),
                        Metodo.valueOf(fila.getString("metodo")), fila.getBigDecimal("total"),
                        fila.getObject("cobrado_en", OffsetDateTime.class))).optional();
    }

    private Recibo recibo(Cobro cobro, int mesa) {
        var ids = jdbc.sql("SELECT id_pedido FROM pedidos WHERE id_cobro = :cobro ORDER BY id_pedido")
                .param("cobro", cobro.id()).query(Long.class).list();
        return new Recibo(cobro.id(), mesa, ids, cobro.metodo(), cobro.total(), cobro.fecha());
    }

    public enum Metodo { EFECTIVO, TARJETA, YAPE }

    public record Solicitud(@NotNull UUID idSolicitud, @NotEmpty List<@NotNull @Positive Long> idPedidos,
            @NotNull Metodo metodo, @NotNull @AssertTrue Boolean confirmado) {}

    public record Cuenta(long idMesa, int mesa, List<Long> idPedidos, long pendientesEntrega, BigDecimal total) {}

    public record Recibo(long idCobro, int mesa, List<Long> idPedidos, Metodo metodo, BigDecimal total,
            OffsetDateTime cobradoEn) {}

    private record PedidoPendiente(long idMesa, int mesa, long idPedido, String estado, BigDecimal total) {}

    private record Cobro(long id, Metodo metodo, BigDecimal total, OffsetDateTime fecha) {}
}
