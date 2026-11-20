package pe.chew;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class PedidosPersonalController {
    private final JdbcClient jdbc;
    private final CobrosMesaService cobros;
    private final PersonalService personal;
    private final MesasService mesas;

    public PedidosPersonalController(JdbcClient jdbc, CobrosMesaService cobros, PersonalService personal,
            MesasService mesas) {
        this.jdbc = jdbc;
        this.cobros = cobros;
        this.personal = personal;
        this.mesas = mesas;
    }

    @GetMapping("/mesero/mesas")
    public ResponseEntity<List<MesasService.Mesa>> listarMesas(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(mesas.listar());
    }

    @PostMapping("/mesero/mesas/uniones")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unirMesas(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @Valid @RequestBody Union solicitud) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        mesas.unir(solicitud.principal(), solicitud.secundaria());
    }

    @DeleteMapping("/mesero/mesas/{numero}/union")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void separarMesas(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @PathVariable int numero) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        mesas.separar(numero);
    }

    public record Union(@NotNull @Positive Integer principal, @NotNull @Positive Integer secundaria) {}

    @GetMapping("/cocina/pedidos")
    public ResponseEntity<List<Comanda>> listarCocina(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.COCINA, autorizacion);
        return listar(List.of("RECIBIDO", "PREPARANDO", "LISTO"));
    }

    @PatchMapping("/cocina/pedidos/{idPedido}/estado")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarEstadoCocina(@PathVariable long idPedido, @Valid @RequestBody Cambio cambio,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.COCINA, autorizacion);
        String anterior = switch (cambio.estado()) {
            case PREPARANDO -> "RECIBIDO";
            case LISTO -> "PREPARANDO";
        };
        actualizar(idPedido, anterior, cambio.estado().name());
    }

    @GetMapping("/mesero/pedidos")
    public ResponseEntity<List<Comanda>> listarMesero(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        return listar(List.of("LISTO"));
    }

    @PatchMapping("/mesero/pedidos/{idPedido}/entrega")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void entregar(@PathVariable long idPedido,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        actualizar(idPedido, "LISTO", "ENTREGADO");
    }

    @GetMapping("/mesero/cuentas")
    public ResponseEntity<List<CobrosMesaService.Cuenta>> listarCuentas(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(cobros.listar());
    }

    @PostMapping("/mesero/cuentas/{idMesa}/cobros")
    public ResponseEntity<CobrosMesaService.Recibo> cobrar(@PathVariable long idMesa,
            @Valid @RequestBody CobrosMesaService.Solicitud solicitud,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigirOperativo(PersonalService.Rol.MESERO, autorizacion);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(cobros.cobrar(idMesa, solicitud));
    }

    private ResponseEntity<List<Comanda>> listar(List<String> estados) {
        List<Comanda> lista = jdbc.sql("""
                SELECT p.id_pedido, m.numero AS mesa, p.estado, d.nombre_plato, d.cantidad, d.opciones_preparacion
                FROM pedidos p
                JOIN mesas m ON m.id_mesa = p.id_mesa
                JOIN detalles_pedido d ON d.id_pedido = p.id_pedido
                WHERE p.estado IN (:estados)
                ORDER BY p.creado_en, p.id_pedido, d.id_plato, d.opciones_preparacion
                """).param("estados", estados).query(filas -> {
            Map<Long, Comanda> pedidos = new LinkedHashMap<>();
            while (filas.next()) {
                long id = filas.getLong("id_pedido");
                Comanda pedido = pedidos.get(id);
                if (pedido == null) {
                    pedido = new Comanda(id, filas.getInt("mesa"),
                            filas.getString("estado"), new ArrayList<>());
                    pedidos.put(id, pedido);
                }
                pedido.platos().add(new Plato(
                        filas.getString("nombre_plato"), filas.getInt("cantidad"),
                        filas.getString("opciones_preparacion").lines().toList()));
            }
            return List.copyOf(pedidos.values());
        });
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(lista);
    }

    private void actualizar(long idPedido, String anterior, String nuevo) {
        int actualizados = jdbc.sql("""
                UPDATE pedidos SET estado = :nuevo
                WHERE id_pedido = :id AND estado = :anterior
                """).param("id", idPedido).param("nuevo", nuevo).param("anterior", anterior).update();
        if (actualizados > 0)
            return;

        String actual = jdbc.sql("SELECT estado FROM pedidos WHERE id_pedido = :id")
                .param("id", idPedido).query(String.class).optional()
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Pedido inexistente"));
        if (!nuevo.equals(actual)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "El pedido no permite ese cambio de estado");
        }
    }

    public enum EstadoCocina {
        PREPARANDO, LISTO
    }

    public record Cambio(@NotNull EstadoCocina estado) {
    }

    public record Comanda(long idPedido, int mesa, String estado, List<Plato> platos) {
    }

    public record Plato(String nombre, int cantidad, List<String> opciones) {
    }
}
