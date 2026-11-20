import { Injectable, inject, signal, computed } from '@angular/core';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { LoginResponse, Rol } from './models';

const STORAGE_KEY = 'chew_empleado';
@Injectable({providedIn: 'root'})
export class AuthService {
  private api = inject(ApiService);
  private sesion = signal<LoginResponse | null>(this.leer());
  readonly usuario = computed(() => this.sesion()?.usuario ?? '');
  readonly rol = computed(() => this.sesion()?.rol ?? null);
  readonly autenticado = computed(() => !!this.token());

  token(): string | null {
    const sesion = this.sesion();
    if (!sesion || Date.parse(sesion.expiraEn) <= Date.now()) return null;
    return sesion.accessToken;
  }
  login(username: string, password: string) {
    return this.api.login(username, password).pipe(tap(sesion => {
      this.sesion.set(sesion);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
    }));
  }
  logout(): void {
    this.sesion.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }
  inicioParaRol(rol: Rol): string {
    return rol === 'ADMIN' ? '/admin' : rol === 'MESERO' ? '/mesero' : '/cocina';
  }
  private leer(): LoginResponse | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) as LoginResponse : null;
      return data && Date.parse(data.expiraEn) > Date.now() ? data : null;
    } catch { return null; }
  }
}
