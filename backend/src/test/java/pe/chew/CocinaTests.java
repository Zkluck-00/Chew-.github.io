package pe.chew;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"CHEW_COCINA_TOKEN=cocina-secreto", "CHEW_MESERO_TOKEN=mesero-secreto"})
@AutoConfigureMockMvc
@Transactional
class CocinaTests {
    private static final String API_COCINA = "/api/cocina/pedidos";
    private static final String TOKEN_AUTORIZADO = "Bearer cocina-secreto";

    @Autowired MockMvc api;
    @Autowired JdbcClient jdbc;

    @Test
    void rechazaAccesoSinTokenOConTokenInvalido() throws Exception {
        api.perform(get(API_COCINA))
                .andExpect(status().isUnauthorized());

        api.perform(get(API_COCINA).header(HttpHeaders.AUTHORIZATION, "Bearer clave-falsa"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listaComandasConPlatosYObservaciones() throws Exception {
        long mesa = mesa(901);
        long plato1 = plato("PLT-101", "Lomo Saltado", 38.00);
        long plato2 = plato("PLT-102", "Chicha Morada", 12.00);

        long idPedido = pedido(mesa, "RECIBIDO", 50.00);
        detalle(idPedido, plato1, "Lomo Saltado", 1, 38.00, "Término 3/4");
        detalle(idPedido, plato2, "Chicha Morada", 1, 12.00, "Bien helada");

        api.perform(get(API_COCINA).header(HttpHeaders.AUTHORIZATION, TOKEN_AUTORIZADO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.idPedido == " + idPedido + ")].mesa").value(hasItem(901)))
                .andExpect(jsonPath("$[?(@.idPedido == " + idPedido + ")].platos[0].nombre").value(hasItem("Lomo Saltado")))
                .andExpect(jsonPath("$[?(@.idPedido == " + idPedido + ")].platos[0].observacion").value(hasItem("Término 3/4")));
    }

    @Test
    void validaTransicionesDeEstadoEnCocina() throws Exception {
        long mesa = mesa(902);
        long idPedido = pedido(mesa, "RECIBIDO", 45.00);

        // Intento inválido: no puede saltar directo de RECIBIDO a LISTO (debe arrojar 409 Conflict)
        api.perform(patch(API_COCINA + "/" + idPedido + "/estado")
                .header(HttpHeaders.AUTHORIZATION, TOKEN_AUTORIZADO)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"estado\":\"LISTO\"}"))
                .andExpect(status().isConflict());

        // Transición válida: RECIBIDO -> PREPARANDO
        api.perform(patch(API_COCINA + "/" + idPedido + "/estado")
                .header(HttpHeaders.AUTHORIZATION, TOKEN_AUTORIZADO)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"estado\":\"PREPARANDO\"}"))
                .andExpect(status().isNoContent());

        // Transición válida: PREPARANDO -> LISTO
        api.perform(patch(API_COCINA + "/" + idPedido + "/estado")
                .header(HttpHeaders.AUTHORIZATION, TOKEN_AUTORIZADO)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"estado\":\"LISTO\"}"))
                .andExpect(status().isNoContent());
    }

    private long mesa(int numero) {
        jdbc.sql("INSERT INTO mesas (numero) VALUES (:numero)").param("numero", numero).update();
        return jdbc.sql("SELECT id_mesa FROM mesas WHERE numero = :numero")
                .param("numero", numero).query(Long.class).single();
    }

    private long plato(String codigo, String nombre, double precio) {
        jdbc.sql("""
                INSERT INTO platos (codigo_plato, nombre, precio, activo)
                VALUES (:codigo, :nombre, :precio, TRUE)
                """).param("codigo", codigo).param("nombre", nombre).param("precio", precio).update();
        return jdbc.sql("SELECT id_plato FROM platos WHERE codigo_plato = :codigo")
                .param("codigo", codigo).query(Long.class).single();
    }

    private long pedido(long mesa, String estado, double total) {
        UUID solicitud = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO pedidos (id_mesa, id_solicitud, estado, total)
                VALUES (:mesa, :solicitud, :estado, :total)
                """).param("mesa", mesa).param("solicitud", solicitud).param("estado", estado).param("total", total).update();
        return jdbc.sql("SELECT id_pedido FROM pedidos WHERE id_mesa = :mesa AND id_solicitud = :solicitud")
                .param("mesa", mesa).param("solicitud", solicitud).query(Long.class).single();
    }

    private void detalle(long pedido, long plato, String nombre, int cantidad, double precio, String observacion) {
        jdbc.sql("""
                INSERT INTO detalles_pedido (id_pedido, id_plato, nombre_plato, cantidad, precio_unitario, observacion)
                VALUES (:pedido, :plato, :nombre, :cantidad, :precio, :observacion)
                """).param("pedido", pedido).param("plato", plato).param("nombre", nombre)
                .param("cantidad", cantidad).param("precio", precio).param("observacion", observacion).update();
    }
}
