import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Rol } from './models';

export function roleGuard(...roles: Rol[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.token()) return router.createUrlTree(['/ingresar']);
    return roles.includes(auth.rol()!) ? true : router.createUrlTree(['/sin-acceso']);
  };
}
