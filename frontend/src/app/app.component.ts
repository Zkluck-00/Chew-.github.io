import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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
        <a routerLink="/menu" class="marca" aria-label="Chew, ir a la carta">
          <img src="/chew-logo.png" alt="" width="42" height="42" />
          <span>CHEW<small>Restaurante digital</small></span>
        </a>
        <nav class="navegacion" aria-label="Navegacion principal">
          <a routerLink="/menu" routerLinkActive="activo">Carta</a>
          <a routerLink="/mis-pedidos" routerLinkActive="activo">Mis pedidos</a>
          <a routerLink="/resumen" routerLinkActive="activo">Carrito <span class="contador">{{ carrito.cantidad() }}</span></a>
          @if (auth.autenticado()) {
            <a [routerLink]="auth.inicioParaRol(auth.rol()!)" routerLinkActive="activo">Panel {{ auth.rol() }}</a>
            <button class="enlace-salir" type="button" (click)="salir()">Salir</button>
          } @else {
            <a routerLink="/ingresar" routerLinkActive="activo">Personal</a>
          }
        </nav>
      </div>
    </header>
    <main class="contenedor principal">
      @if (mesa.mesa() > 0) {
        <div class="mesa-aviso"><span>●</span> Mesa {{ mesa.mesa() }} · Pedido por QR</div>
      }
      <router-outlet />
    </main>
    <footer class="pie"><div class="contenedor">Chew · Pedidos por QR y gestion del restaurante · Proyecto academico</div></footer>
  `
})
export class AppComponent {
  readonly auth = inject(AuthService);
  readonly carrito = inject(CarritoService);
  readonly mesa = inject(MesaService);
  private router = inject(Router);
  salir(): void { this.auth.logout(); void this.router.navigateByUrl('/ingresar'); }
}
