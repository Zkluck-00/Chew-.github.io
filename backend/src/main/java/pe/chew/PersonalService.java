package pe.chew;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PersonalService implements ApplicationRunner {
    public enum Rol { ADMIN, COCINA, MESERO }

    public record Usuario(long id, String username, Rol rol, boolean activo) {}
    public record Sesion(String accessToken, String tokenType, String usuario, Rol rol, OffsetDateTime expiraEn) {}
    private record Cuenta(long id, String usuario, String hash, Rol rol, boolean activo) {}

    private final JdbcClient jdbc;
    private final String administrador;
    private final String claveInicial;
    private final String claveCocina;
    private final String claveMesero;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();
    private final String hashInvalido = encoder.encode("clave de descarte");

    public PersonalService(JdbcClient jdbc,
            @Value("${CHEW_ADMIN_USER:}") String administrador,
            @Value("${CHEW_ADMIN_PASSWORD:}") String claveInicial,
            @Value("${CHEW_COCINA_TOKEN:}") String claveCocina,
            @Value("${CHEW_MESERO_TOKEN:}") String claveMesero) {
        this.jdbc = jdbc;
        this.administrador = administrador;
        this.claveInicial = claveInicial;
        this.claveCocina = claveCocina;
        this.claveMesero = claveMesero;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (administrador.isBlank() && claveInicial.isBlank()) return;
        if (hayAdministrador()) return;
        try {
            crear(administrador, claveInicial, Rol.ADMIN);
        } catch (ResponseStatusException falla) {
            if (falla.getStatusCode() != HttpStatus.CONFLICT || !hayAdministrador()) throw falla;
        }
    }

    private boolean hayAdministrador() {
        return jdbc.sql("SELECT COUNT(*) FROM personal WHERE rol = 'ADMIN' AND activo")
                .query(Long.class).single() > 0;
    }

    @Transactional
    public Sesion iniciar(String nombre, String clave) {
        var cuenta = jdbc.sql("SELECT id, usuario, clave_hash, rol, activo FROM personal WHERE usuario = :usuario")
                .param("usuario", normalizar(nombre)).query((fila, i) -> new Cuenta(fila.getLong(1),
                        fila.getString(2), fila.getString(3), Rol.valueOf(fila.getString(4)), fila.getBoolean(5)))
                .optional();
        boolean valida = bytes(clave).length <= 72
                && encoder.matches(clave, cuenta.map(Cuenta::hash).orElse(hashInvalido));
        if (!valida || cuenta.isEmpty() || !cuenta.get().activo()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario o contraseña inválidos");
        }
        Cuenta usuario = cuenta.get();
        byte[] secreto = new byte[32];
        random.nextBytes(secreto);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secreto);
        OffsetDateTime ahora = OffsetDateTime.now(ZoneOffset.UTC);
        OffsetDateTime vence = ahora.plusHours(8);
        jdbc.sql("DELETE FROM sesiones_personal WHERE expira_en <= :ahora")
                .param("ahora", ahora).update();
        jdbc.sql("INSERT INTO sesiones_personal VALUES (:hash, :id, :vence)")
                .param("hash", hash(token)).param("id", usuario.id()).param("vence", vence).update();
        return new Sesion(token, "Bearer", usuario.usuario(), usuario.rol(), vence);
    }

    public void cerrar(String autorizacion) {
        token(autorizacion).ifPresent(token -> jdbc.sql("DELETE FROM sesiones_personal WHERE token_hash = :hash")
                .param("hash", hash(token)).update());
    }

    public void exigirOperativo(Rol rol, String autorizacion) {
        String clave = switch (rol) {
            case COCINA -> claveCocina;
            case MESERO -> claveMesero;
            case ADMIN -> "";
        };
        if (!clave.isBlank() && autorizacion != null
                && MessageDigest.isEqual(bytes("Bearer " + clave), bytes(autorizacion))) return;
        exigir(rol, autorizacion);
    }

    public Usuario exigir(Rol rol, String autorizacion) {
        Usuario persona = token(autorizacion).flatMap(token -> jdbc.sql("""
                SELECT p.id, p.usuario, p.rol, p.activo
                FROM personal p JOIN sesiones_personal s ON s.id_personal = p.id
                WHERE s.token_hash = :hash AND s.expira_en > CURRENT_TIMESTAMP AND p.activo
                """).param("hash", hash(token)).query((fila, numero) -> new Usuario(
                        fila.getLong(1), fila.getString(2), Rol.valueOf(fila.getString(3)), fila.getBoolean(4)))
                .optional()).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sesión inválida"));
        if (persona.rol() != rol && persona.rol() != Rol.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "La cuenta no tiene permiso");
        }
        return persona;
    }

    public List<Usuario> listar() {
        return jdbc.sql("SELECT id, usuario, rol, activo FROM personal ORDER BY usuario")
                .query((fila, numero) -> new Usuario(fila.getLong(1), fila.getString(2),
                        Rol.valueOf(fila.getString(3)), fila.getBoolean(4))).list();
    }

    public void crear(String username, String clave, Rol rol) {
        String usuario = normalizar(username);
        if (!usuario.matches("[a-z0-9._-]{3,80}") || clave.isBlank()
                || clave.length() < 12 || bytes(clave).length > 72) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuario o contraseña fuera del formato permitido");
        }
        try {
            jdbc.sql("INSERT INTO personal (usuario, clave_hash, rol) VALUES (:usuario, :hash, :rol)")
                    .param("usuario", usuario).param("hash", encoder.encode(clave)).param("rol", rol.name()).update();
        } catch (DuplicateKeyException falla) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este usuario ya existe");
        }
    }

    @Transactional
    public void cambiar(long id, Rol rol, Boolean activo, String autorizacion) {
        jdbc.sql("SELECT id FROM personal WHERE rol = 'ADMIN' AND activo ORDER BY id FOR UPDATE")
                .query(Long.class).list();
        Usuario operador = exigir(Rol.ADMIN, autorizacion);
        if (id == operador.id()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes cambiar tu propio acceso");
        }
        if (rol == null && activo == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Indica el rol o estado");
        }
        int filas = jdbc.sql("""
                UPDATE personal SET rol = COALESCE(:rol, rol), activo = COALESCE(:activo, activo)
                WHERE id = :id
                """).param("rol", rol == null ? null : rol.name(), java.sql.Types.VARCHAR)
                .param("activo", activo, java.sql.Types.BOOLEAN).param("id", id).update();
        if (filas == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario inexistente");
        jdbc.sql("DELETE FROM sesiones_personal WHERE id_personal = :id").param("id", id).update();
    }

    private static Optional<String> token(String autorizacion) {
        return autorizacion != null && autorizacion.matches("Bearer [a-zA-Z0-9_-]{43}")
                ? Optional.of(autorizacion.substring(7)) : Optional.empty();
    }

    private static String normalizar(String usuario) {
        return usuario.strip().toLowerCase(Locale.ROOT);
    }

    private static byte[] bytes(String valor) {
        return valor.getBytes(StandardCharsets.UTF_8);
    }

    private static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes(token)));
        } catch (NoSuchAlgorithmException falla) {
            throw new IllegalStateException(falla);
        }
    }
}
