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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"CHEW_MESERO_TOKEN=mesero-prueba", "CHEW_COCINA_TOKEN=cocina-prueba"})
@AutoConfigureMockMvc
@Transactional
class CobrosMesaTests {
    private static final String API = "/api/mesero/cuentas";
    private static final String AUTORIZADO = "Bearer mesero-prueba";

    @Autowired MockMvc api;
    @Autowired JdbcClient jdbc;

    @Test
    void elReintentoDevuelveElMismoCobroYLaMesaPuedeAbrirOtraCuenta() throws Exception {
        long mesa = mesa(501);
        long primero = pedido(mesa, "ENTREGADO", 50);
        long segundo = pedido(mesa, "ENTREGADO", 100);
        UUID solicitud = UUID.randomUUID();
        String cuerpo = solicitud(solicitud, primero + "," + segundo, true);

        api.perform(get(API).header(HttpHeaders.AUTHORIZATION, AUTORIZADO))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].total").value(150));
        String recibo = api.perform(cobrar(mesa, cuerpo))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(150))
                .andReturn().getResponse().getContentAsString();

        long siguiente = pedido(mesa, "ENTREGADO", 25);
        api.perform(cobrar(mesa, cuerpo)).andExpect(status().isOk()).andExpect(content().string(recibo));
        api.perform(cobrar(mesa, solicitud(UUID.randomUUID(), primero + "," + segundo, true)))
                .andExpect(status().isConflict());
        api.perform(get(API).header(HttpHeaders.AUTHORIZATION, AUTORIZADO))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].idPedidos[0]").value(siguiente))
                .andExpect(jsonPath("$[0].total").value(25));

        assertThat(jdbc.sql("SELECT COUNT(*) FROM cobros_mesa WHERE id_mesa = :mesa")
                .param("mesa", mesa).query(Long.class).single()).isEqualTo(1);
    }

    @Test
    void exigeConfirmacionYEsperaLasEntregasDeTodaLaMesa() throws Exception {
        long mesa = mesa(502);
        long entregado = pedido(mesa, "ENTREGADO", 50);
        long enCocina = pedido(mesa, "PREPARANDO", 100);
        String ambos = entregado + "," + enCocina;

        api.perform(get(API).header(HttpHeaders.AUTHORIZATION, "Bearer cocina-prueba"))
                .andExpect(status().isUnauthorized());
        api.perform(cobrar(mesa, solicitud(UUID.randomUUID(), ambos, false)))
                .andExpect(status().isBadRequest());
        api.perform(cobrar(mesa, solicitud(UUID.randomUUID(), Long.toString(entregado), true)))
                .andExpect(status().isConflict());
        api.perform(cobrar(mesa, solicitud(UUID.randomUUID(), ambos, true)))
                .andExpect(status().isConflict());

        assertThat(jdbc.sql("SELECT COUNT(*) FROM cobros_mesa WHERE id_mesa = :mesa")
                .param("mesa", mesa).query(Long.class).single()).isZero();
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder cobrar(long mesa, String cuerpo) {
        return post(API + "/" + mesa + "/cobros").header(HttpHeaders.AUTHORIZATION, AUTORIZADO)
                .contentType(MediaType.APPLICATION_JSON).content(cuerpo);
    }

    private String solicitud(UUID id, String pedidos, boolean confirmado) {
        return """
                {"idSolicitud":"%s","idPedidos":[%s],"metodo":"YAPE","confirmado":%s}
                """.formatted(id, pedidos, confirmado);
    }

    private long mesa(int numero) {
        jdbc.sql("INSERT INTO mesas (numero) VALUES (:numero)").param("numero", numero).update();
        return jdbc.sql("SELECT id_mesa FROM mesas WHERE numero = :numero")
                .param("numero", numero).query(Long.class).single();
    }

    private long pedido(long mesa, String estado, int total) {
        UUID solicitud = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO pedidos (id_mesa, id_solicitud, estado, total) VALUES (:mesa, :solicitud, :estado, :total)
                """).param("mesa", mesa).param("solicitud", solicitud).param("estado", estado).param("total", total).update();
        return jdbc.sql("SELECT id_pedido FROM pedidos WHERE id_mesa = :mesa AND id_solicitud = :solicitud")
                .param("mesa", mesa).param("solicitud", solicitud).query(Long.class).single();
    }
}
