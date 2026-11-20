package pe.chew;

import java.util.HashSet;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class OpcionesPreparacion {
    private OpcionesPreparacion() {}

    public record Opcion(String nombre, String grupo) {}

    static List<Opcion> catalogo(String opciones) {
        return opciones.lines().map(nombre -> new Opcion(nombre, grupo(nombre))).toList();
    }

    static String validar(List<String> elegidas, String opciones) {
        if (elegidas == null || elegidas.isEmpty()) return "";
        var grupos = new HashSet<String>();
        var disponibles = opciones.lines().toList();
        for (String elegida : elegidas) {
            String grupo = grupo(elegida);
            if (!disponibles.contains(elegida) || !grupos.add(grupo == null ? elegida : grupo)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Opciones de preparación inválidas");
            }
        }
        return String.join("\n", elegidas.stream().sorted().toList());
    }

    private static String grupo(String nombre) {
        return switch (nombre) {
            case "Con ají", "Sin ají", "Poco picante", "Muy picante", "Preparación normal" -> "ají";
            case "Helada", "Sin helar", "Con hielo aparte" -> "temperatura";
            case "Normal", "Sin azúcar", "Regular azúcar" -> "azúcar";
            case "Término medio", "Bien cocido" -> "cocción";
            default -> null;
        };
    }
}
