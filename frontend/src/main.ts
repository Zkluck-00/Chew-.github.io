import { provideRouter, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PedidosPersonalComponent } from './app/staff/pedidos-personal';
import { CocinaComponent } from './app/staff/cocina.component';
import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AuthService } from './app/core/auth.service';
import { jwtInterceptor } from './app/core/auth.interceptor';
import { roleGuard } from './app/core/auth.guard';
import { AdminComponent } from './app/staff/admin.component';
import { LoginComponent } from './app/staff/login.component';
import { OpcionesPreparacionComponent } from './app/cliente/opciones-preparacion';
import { OpcionPreparacion } from './app/core/models';
import { SinAccesoComponent } from './app/staff/sin-acceso.component';

interface Plato {
  idPlato: number;
  nombre: string;
  precio: number;
  descripcion?: string | null;
  categoria?: string | null;
  imagen?: string | null;
  nombreCarta?: string | null;
  grupoCatalogo?: string | null;
  variante?: string | null;
  opciones?: OpcionPreparacion[];
}

interface ProductoCarta {
  clave: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  imagen: string;
  variantes: Plato[];
}

interface LineaCarta {
  clave: string;
  idPlato: number;
  nombre: string;
  precio: number;
  opciones: string[];
  cantidad: number;
}

interface Recibo {
  idPedido: number;
  total: number;
}

@Component({
  selector: 'app-carta',
  imports: [CurrencyPipe, OpcionesPreparacionComponent],
  templateUrl: './app/cliente/carta.component.html',
  styleUrl: './app/cliente/carta.component.scss',
})
class Carta {
  private readonly http = inject(HttpClient);
  private readonly parametros = new URLSearchParams(window.location.search);
  private idSolicitud: string | null = null;
  readonly mesa = Number(this.parametros.get('mesa'));
  private readonly token = this.parametros.get('token') ?? '';
  readonly tieneQr = Number.isInteger(this.mesa) && this.mesa > 0 && this.mesa <= 2147483647
    && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(this.token);
  readonly platos = signal<Plato[] | null>(null);
  readonly busqueda = signal('');
  readonly categoria = signal('');
  readonly productos = computed(() => {
    const grupos = new Map<string, ProductoCarta>();
    for (const plato of this.platos() ?? []) {
      const clave = plato.grupoCatalogo ?? `plato-${plato.idPlato}`;
      const grupo = grupos.get(clave);
      if (grupo) {
        grupo.variantes.push(plato);
      } else {
        grupos.set(clave, { clave, nombre: plato.nombreCarta ?? plato.nombre,
          categoria: plato.categoria || 'Platos', descripcion: plato.descripcion ?? '',
          imagen: plato.imagen?.startsWith('https://') ? plato.imagen : '/chew-logo.png',
          variantes: [plato] });
      }
    }
    return Array.from(grupos.values());
  });
  readonly categorias = computed(() => [...new Set(this.productos().map(producto => producto.categoria))]);
  readonly visibles = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    const categoria = this.categoria();
    return this.productos().filter(producto => (!categoria || producto.categoria === categoria)
      && normalizar(`${producto.nombre} ${producto.descripcion} ${producto.categoria}`).includes(texto));
  });
  readonly elegidas = signal<Partial<Record<string, number>>>({});

  elegir(producto: ProductoCarta, id: string): void {
    this.elegidas.update(actual => ({ ...actual, [producto.clave]: Number(id) }));
  }

  fotoAlternativa(imagen: HTMLImageElement): void {
    if (imagen.getAttribute('src') !== '/chew-logo.png') imagen.src = '/chew-logo.png';
  }

  readonly preparaciones = signal<Partial<Record<number, string[]>>>({});
  readonly seleccion = signal<LineaCarta[]>([]);
  readonly unidades = computed(() => this.seleccion().reduce((total, linea) => total + linea.cantidad, 0));

  elegirPreparacion(idPlato: number, opciones: string[]): void {
    this.preparaciones.update(actual => ({ ...actual, [idPlato]: opciones }));
  }

  cantidad(idPlato: number, opciones: string[]): number {
    const clave = JSON.stringify([idPlato, opciones]);
    return this.seleccion().find(linea => linea.clave === clave)?.cantidad ?? 0;
  }

  readonly totalEstimado = computed(() =>
    this.seleccion().reduce((total, plato) => total + plato.precio * plato.cantidad, 0),
  );
  readonly enviando = signal(false);
  readonly errorCarta = signal(false);
  readonly errorPedido = signal('');
  readonly recibo = signal<Recibo | null>(null);

  constructor() {
    this.cargarCarta();
  }

  cargarCarta(): void {
    this.errorCarta.set(false);
    this.platos.set(null);
    this.http.get<Plato[]>('/api/platos/activos').subscribe({
      next: platos => this.platos.set(platos),
      error: () => this.errorCarta.set(true),
    });
  }

  cambiar(plato: Pick<Plato, 'idPlato' | 'nombre' | 'precio'>, opciones: string[], cambio: number): void {
    if (this.enviando() || this.unidades() + cambio > 7) return;
    const clave = JSON.stringify([plato.idPlato, opciones]);
    const previa = this.seleccion().find(linea => linea.clave === clave);
    const cantidad = (previa?.cantidad ?? 0) + cambio;
    if (cantidad < 0) return;

    this.seleccion.update(actual => {
      if (cantidad === 0) return actual.filter(linea => linea.clave !== clave);
      if (!previa) return [...actual, { ...plato, opciones, clave, cantidad }];
      return actual.map(linea => linea.clave === clave ? { ...linea, cantidad } : linea);
    });
    this.idSolicitud = null;
    this.errorPedido.set('');
    this.recibo.set(null);
  }

  enviar(): void {
    if (!this.tieneQr || this.enviando() || !this.unidades() || this.unidades() > 7) return;

    const items = this.seleccion().map(({idPlato, cantidad, opciones}) => ({idPlato, cantidad, opciones}));

    this.idSolicitud ??= crypto.randomUUID();
    this.errorPedido.set('');
    this.enviando.set(true);

    this.http.post<Recibo>('/api/pedidos', {
      mesa: this.mesa, token: this.token, idSolicitud: this.idSolicitud, items,
    }).subscribe({
      next: recibo => {
        this.recibo.set(recibo);
        this.seleccion.set([]);
        this.idSolicitud = null;
        this.enviando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.errorPedido.set(error.status === 403
          ? 'El QR de esta mesa no es válido. Vuelve a escanearlo.'
          : 'No se pudo confirmar el pedido. Revisa la selección o vuelve a intentar.');
        this.enviando.set(false);
      },
    });
  }
}

function normalizar(texto: string): string {
  return texto.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="cabecera">
      <div class="contenedor fila-nav">
        <a routerLink="/" queryParamsHandling="preserve" class="marca" aria-label="Chew, ir a la carta">
          <img src="/chew-logo.png" alt="" width="42" height="42" />
          <span>CHEW</span>
        </a>
        <nav class="navegacion" aria-label="Navegación principal">
          <a routerLink="/" queryParamsHandling="preserve" routerLinkActive="activo"
            [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }"
            ariaCurrentWhenActive="page">Carta</a>
          <a routerLink="/cocina" routerLinkActive="activo" ariaCurrentWhenActive="page">Cocina</a>
          <a routerLink="/mesero" routerLinkActive="activo" ariaCurrentWhenActive="page">Mesero</a>
          @if (auth.rol() === 'ADMIN' && auth.autenticado()) {
            <a routerLink="/admin" routerLinkActive="activo" ariaCurrentWhenActive="page">Administración</a>
          }
          @if (auth.autenticado()) {
            <button class="enlace-salir" type="button" (click)="salir()">Cerrar sesión</button>
          } @else {
            <a routerLink="/ingresar" routerLinkActive="activo" ariaCurrentWhenActive="page">Personal</a>
          }
        </nav>
      </div>
    </header>
    <router-outlet />
  `,
})
class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  salir(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/ingresar');
  }
}

bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideRouter([
      { path: '', pathMatch: 'full', component: Carta },
      { path: 'ingresar', component: LoginComponent, title: 'Acceso del personal | Chew' },
      { path: 'admin', component: AdminComponent, canActivate: [roleGuard('ADMIN')], title: 'Administración | Chew' },
      { path: 'sin-acceso', component: SinAccesoComponent, title: 'Sin acceso | Chew' },
      { path: 'menu', redirectTo: '', pathMatch: 'full' },
      { path: 'cocina', component: CocinaComponent, data: { rol: 'cocina' } },
      { path: 'mesero', component: PedidosPersonalComponent, data: { rol: 'mesero' } },
    ]),
  ],
}).catch(err => console.error(err));
