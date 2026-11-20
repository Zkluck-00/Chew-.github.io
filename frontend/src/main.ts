import { provideRouter, RouterOutlet } from '@angular/router';
import { PedidosPersonalComponent } from './pedidos-personal';
import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

interface Plato {
  idPlato: number;
  nombre: string;
  precio: number;
}

interface Recibo {
  idPedido: number;
  total: number;
}

@Component({
  selector: 'app-carta',
  imports: [CurrencyPipe],
  template: `
    <main>
      <h1>Carta de Chew</h1>
      @if (tieneQr) { <p>Mesa {{ mesa }}</p> }
      @else { <p>Abre la carta desde el QR de tu mesa para pedir.</p> }

      @let carta = platos();
      @if (errorCarta()) {
        <p role="alert">No se pudo cargar la carta. Recarga la página.</p>
      } @else if (carta) {
        <ul>
          @for (plato of carta; track plato.idPlato) {
            <li>
              <span>{{ plato.nombre }} · {{ plato.precio | currency:'PEN':'S/ ' }}</span>
              @if (tieneQr) {
                <div class="cantidad">
                  <button type="button" [attr.aria-label]="'Quitar ' + plato.nombre"
                    [disabled]="enviando() || !cantidades()[plato.idPlato]"
                    (click)="cambiar(plato.idPlato, -1)">−</button>
                  <span>{{ cantidades()[plato.idPlato] || 0 }}</span>
                  <button type="button" [attr.aria-label]="'Agregar ' + plato.nombre"
                    [disabled]="enviando() || unidades() >= 7"
                    (click)="cambiar(plato.idPlato, 1)">+</button>
                </div>
              }
            </li>
          } @empty {
            <li>Por ahora no hay platos disponibles.</li>
          }
        </ul>
      } @else {
        <p role="status">Cargando platos…</p>
      }

      @if (errorPedido()) { <p role="alert">{{ errorPedido() }}</p> }
      @if (recibo(); as pedido) {
        <p role="status">Pedido #{{ pedido.idPedido }} registrado.
          Total {{ pedido.total | currency:'PEN':'S/ ' }}.</p>
      }
      @if (tieneQr && carta && carta.length) {
        <button type="button" [disabled]="enviando() || !unidades()" (click)="enviar()">
          {{ enviando() ? 'Enviando…' : 'Enviar pedido a cocina' }}
        </button>
        <p>{{ unidades() }} de 7 unidades</p>
      }
    </main>
  `,
  styles: [`
    main { margin: 3rem auto; padding: 0 1.5rem; max-width: 42rem; font-family: system-ui; }
    ul { padding: 0; list-style: none; }
    li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.75rem 0; }
    .cantidad { display: flex; align-items: center; gap: 0.5rem; }
    button { padding: 0.45rem 0.75rem; }
  `],
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
  readonly cantidades = signal<Record<number, number>>({});
  readonly unidades = computed(() => Object.values(this.cantidades()).reduce((suma, n) => suma + n, 0));
  readonly enviando = signal(false);
  readonly errorCarta = signal(false);
  readonly errorPedido = signal('');
  readonly recibo = signal<Recibo | null>(null);

  constructor() {
    this.http.get<Plato[]>('/api/platos/activos').subscribe({
      next: platos => this.platos.set(platos),
      error: () => this.errorCarta.set(true),
    });
  }

  cambiar(idPlato: number, cambio: number): void {
    const cantidad = (this.cantidades()[idPlato] ?? 0) + cambio;
    if (this.enviando() || cantidad < 0 || this.unidades() + cambio > 7) return;

    this.cantidades.update(actual => ({ ...actual, [idPlato]: cantidad }));
    this.idSolicitud = null;
    this.errorPedido.set('');
    this.recibo.set(null);
  }

  enviar(): void {
    if (!this.tieneQr || this.enviando() || !this.unidades() || this.unidades() > 7) return;

    const items = Object.entries(this.cantidades())
      .filter(([, cantidad]) => cantidad > 0)
      .map(([idPlato, cantidad]) => ({ idPlato: Number(idPlato), cantidad }));

    this.idSolicitud ??= crypto.randomUUID();
    this.errorPedido.set('');
    this.enviando.set(true);

    this.http.post<Recibo>('/api/pedidos', {
      mesa: this.mesa, token: this.token, idSolicitud: this.idSolicitud, items,
    }).subscribe({
      next: recibo => {
        this.recibo.set(recibo);
        this.cantidades.set({});
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

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class App {}

bootstrapApplication(App, {
provideRouter([
  { path: '', pathMatch: 'full', component: Carta },
  { path: 'cocina', component: PedidosPersonalComponent, data: { rol: 'cocina' } },
  { path: 'mesero', component: PedidosPersonalComponent, data: { rol: 'mesero' } },
]),