import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const jwtInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  const privada = /^\/api\/(admin|cocina|mesero)(\/|$)/.test(request.url)
    || request.url === '/api/auth/me'
    || (request.method !== 'GET' && /^\/api\/(platos|bebidas)(\/|$)/.test(request.url));
  // Los JWT del personal nunca se envian a las rutas publicas ni a terceros.
  if (token && privada) request = request.clone({setHeaders: {Authorization: `Bearer ${token}`}});
  return next(request);
};
