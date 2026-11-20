import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  const privada = /^\/api\/(admin|cocina|mesero)(\/|$)/.test(request.url)
    || request.url === '/api/auth/sesion'
    || (request.method !== 'GET' && /^\/api\/(platos|bebidas)(\/|$)/.test(request.url));
  // La sesión solo se envía a la API protegida de Chew.
  if (token && privada && !request.headers.has('Authorization')) request = request.clone({setHeaders: {Authorization: `Bearer ${token}`}});
  return next(request);
};
