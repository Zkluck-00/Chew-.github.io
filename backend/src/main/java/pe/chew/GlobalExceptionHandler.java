package pe.chew;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorRespuesta> manejarValidacion(MethodArgumentNotValidException ex) {
        List<String> errores = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.toList());

        String mensaje = errores.isEmpty() ? "Datos de entrada inválidos" : errores.get(0);

        ErrorRespuesta respuesta = new ErrorRespuesta(
                OffsetDateTime.now().toString(),
                HttpStatus.BAD_REQUEST.value(),
                "Error de Validación",
                mensaje,
                errores
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(respuesta);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorRespuesta> manejarResponseStatus(ResponseStatusException ex) {
        ErrorRespuesta respuesta = new ErrorRespuesta(
                OffsetDateTime.now().toString(),
                ex.getStatusCode().value(),
                ex.getStatusCode().toString(),
                ex.getReason() != null ? ex.getReason() : "Error en la solicitud",
                List.of()
        );
        return ResponseEntity.status(ex.getStatusCode()).body(respuesta);
    }

    public record ErrorRespuesta(
            String timestamp,
            int status,
            String error,
            String mensaje,
            List<String> detalles
    ) {}
}
