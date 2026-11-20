import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { CarritoService } from './core/carrito.service';
import { MesaService } from './core/mesa.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="cabecera">
      <div class="contenedor fila-nav">
        <!-- Marca / Logo adaptable -->
        <a routerLink="/menu" class="marca" aria-label="Chew, ir al inicio">
          <img src="/chew-logo.png" alt="Logo Chew" width="42" height="42" />
          <span>CHEW
            <small>{{ rolTexto() }}</small>
          </span>
        </a>

        <!-- Barra de navegación adaptable según contexto de rol -->
        <nav class="navegacion" aria-label="Navegación principal">
          @if (esCocina()) {
            <a routerLink="/cocina" routerLinkActive="activo">Panel de Comandas</a>
            <a routerLink="/menu" target="_blank" title="Abrir carta de platos en pestaña nueva">Consultar Carta</a>
            <span class="badge-rol-header">Cocina</span>
            <button class="enlace-salir" type="button" (click)="salir()" title="Salir del panel">Salir</button>
          } @else if (esMesero()) {
            <a routerLink="/mesero" routerLinkActive="activo">Panel Mesero</a>
            <span class="badge-rol-header">Mesero</span>
            <button class="enlace-salir" type="button" (click)="salir()">Salir</button>
          } @else if (esAdmin()) {
            <a routerLink="/admin" routerLinkActive="activo">Administración</a>
            <span class="badge-rol-header">Admin</span>
            <button class="enlace-salir" type="button" (click)="salir()">Salir</button>
          } @else {
            <!-- Navegación de Comensales / Clientes -->
            <a routerLink="/menu" routerLinkActive="activo">Carta</a>
            <a routerLink="/mis-pedidos" routerLinkActive="activo">Mis pedidos</a>
            <a routerLink="/resumen" routerLinkActive="activo">
              Carrito <span class="contador">{{ carrito.cantidad() }}</span>
            </a>
            @if (auth.autenticado()) {
              <a [routerLink]="auth.inicioParaRol(auth.rol()!)" routerLinkActive="activo">Panel {{ auth.rol() }}</a>
              <button class="enlace-salir" type="button" (click)="salir()">Salir</button>
            } @else {
              <a routerLink="/ingresar" routerLinkActive="activo">Personal</a>
            }
          }
        </nav>
      </div>
    </header>

    <main class="contenedor principal" [class.staff-main]="esRutaStaff()">
      @if (mesa.mesa() > 0 && !esRutaStaff()) {
        <div class="mesa-aviso"><span>●</span> Mesa {{ mesa.mesa() }} · Pedido por QR</div>
      }
      <router-outlet />
    </main>

    @if (!esCocina()) {
      <footer class="pie">
        <div class="contenedor">Chew · Pedidos por QR y gestión del restaurante · Proyecto académico</div>
      </footer>
    }
  `,
  styles: [`
    .badge-rol-header {
      background: #ffedd5;
      color: #c2410c;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 9px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .staff-main {
      padding-top: 15px;
      padding-bottom: 30px;
    }
  `]
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly carrito = inject(CarritoService);
  readonly mesa = inject(MesaService);
  private router = inject(Router);

  readonly urlActual = signal<string>(
    typeof window !== 'undefined' ? window.location.pathname : ''
  );

  readonly esCocina = computed(() => this.urlActual().startsWith('/cocina'));
  readonly esMesero = computed(() => this.urlActual().startsWith('/mesero'));
  readonly esAdmin = computed(() => this.urlActual().startsWith('/admin'));
  readonly esRutaStaff = computed(() => this.esCocina() || this.esMesero() || this.esAdmin());

  readonly rolTexto = computed(() => {
    if (this.esCocina()) return 'Módulo Cocina';
    if (this.esMesero()) return 'Módulo Mesero';
    if (this.esAdmin()) return 'Módulo Admin';
    return 'Restaurante digital';
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.urlActual.set(event.urlAfterRedirects || event.url);
      });
  }

  salir(): void {
    if (this.esCocina()) {
      sessionStorage.removeItem('chew_cocina_token');
    }
    this.auth.logout();
    void this.router.navigateByUrl('/menu');
  }
}
