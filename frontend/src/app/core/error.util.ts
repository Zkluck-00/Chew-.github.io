import { HttpErrorResponse } from '@angular/common/http';

export function mensajeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'No hay conexion con Spring Boot. Verifica que este encendido en el puerto 8081.';
    if (error.status === 401) return 'Sesion vencida o credenciales incorrectas. Vuelve a iniciar sesion.';
    if (error.status === 403) return 'Acceso denegado. Verifica tu rol o el token QR de la mesa.';
    const body = error.error;
    if (typeof body?.message === 'string') return body.message;
    if (typeof body?.mensaje === 'string') return body.mensaje;
    if (typeof body?.detail === 'string') return body.detail;
    if (typeof body?.error === 'string') return body.error;
    return `El servidor respondio con HTTP ${error.status}.`;
  }
  return error instanceof Error ? error.message : 'Ocurrio un error inesperado.';
}
