package pe.chew;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class PersonalController {
    private final PersonalService personal;

    private final MesasService mesas;

    public PersonalController(PersonalService personal, MesasService mesas) {
        this.personal = personal;
        this.mesas = mesas;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<PersonalService.Sesion> iniciar(@Valid @RequestBody Credenciales datos) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(personal.iniciar(datos.username(), datos.password()));
    }

    @DeleteMapping("/api/auth/sesion")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void salir(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.cerrar(autorizacion);
    }

    @GetMapping("/api/admin/usuarios")
    public ResponseEntity<List<PersonalService.Usuario>> usuarios(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(personal.listar());
    }

    @GetMapping("/api/admin/mesas")
    public ResponseEntity<List<MesasService.CodigoMesa>> listarCodigos(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(mesas.codigos());
    }

    @PostMapping("/api/admin/usuarios")
    @ResponseStatus(HttpStatus.CREATED)
    public void crear(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @Valid @RequestBody Alta datos) {
        personal.exigir(PersonalService.Rol.ADMIN, autorizacion);
        personal.crear(datos.username(), datos.password(), datos.rol());
    }

    @PatchMapping("/api/admin/usuarios/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void actualizar(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String autorizacion,
            @PathVariable long id, @RequestBody Cambio datos) {
        personal.cambiar(id, datos.rol(), datos.activo(), autorizacion);
    }

    public record Credenciales(@NotBlank @Size(max = 80) String username,
            @NotBlank @Size(max = 72) String password) {}
    public record Alta(@NotBlank @Size(min = 3, max = 80) String username,
            @NotBlank @Size(min = 12, max = 72) String password, @NotNull PersonalService.Rol rol) {}
    public record Cambio(PersonalService.Rol rol, Boolean activo) {}
}
