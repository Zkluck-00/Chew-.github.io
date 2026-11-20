import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { interval } from 'rxjs';

type Estado = 'RECIBIDO' | 'PREPARANDO' | 'LISTO';
type Cambio = 'PREPARANDO' | 'LISTO' | 'ENTREGADO';

interface Comanda {
  idPedido: number;
  mesa: number;
  estado: Estado;
  platos: { nombre: string; cantidad: number }[];
}

@Component({
  selector: 'app-pedidos-personal',
  template: `
    <main>
      <header>
        <h1>{{ titulo }}</h1>
        @if (conectado()) {
          <div class="acciones">
            <button type="button" [disabled]="ocupado()" (click)="cargar()">Actualizar</button>
            <button type="button" [disabled]="ocupado()" (click)="salir()">Salir</button>
          </div>
        }
      </header>

      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (confirmacion()) { <p role="status">{{ confirmacion() }}</p> }

      @if (!conectado()) {
        <form (submit)="entrar($event, clave)">
          <label for="clave">Clave de {{ rol }}</label>
          <input #clave id="clave" type="password" required autocomplete="off">
          <button type="submit" [disabled]="ocupado()">Entrar</button>
        </form>
      } @else {
        <section class="pedidos" [attr.aria-label]="'Pedidos de ' + rol">
          @for (pedido of pedidos(); track pedido.idPedido) {
            <article>
              <p class="estado" [attr.data-estado]="pedido.estado">{{ etiquetas[pedido.estado] }}</p>
              <h2>Pedido #{{ pedido.idPedido }} · Mesa {{ pedido.mesa }}</h2>
              <ul>
                @for (plato of pedido.platos; track $index) {
                  <li>{{ plato.cantidad }} × {{ plato.nombre }}</li>
                }
              </ul>
              @if (rol === 'cocina' && pedido.estado === 'RECIBIDO') {
                <button type="button" [disabled]="ocupado()" (click)="cambiar(pedido, 'PREPARANDO')">
                  Empezar preparación
                </button>
              }
              @if (rol === 'cocina' && pedido.estado === 'PREPARANDO') {
                <button type="button" [disabled]="ocupado()" (click)="cambiar(pedido, 'LISTO')">
                  Marcar listo
                </button>
              }
              @if (rol === 'mesero' && pedido.estado === 'LISTO') {
                <button type="button" [disabled]="ocupado()" (click)="cambiar(pedido, 'ENTREGADO')">
                  Marcar entregado
                </button>
              }
            </article>
          } @empty {
            <p role="status">
              {{ rol === 'mesero' ? 'No hay pedidos listos para entregar.' : 'Aún no hay pedidos en cocina.' }}
            </p>
          }
        </section>
      }
    </main>
  `,
  styles: [`
    main { max-width: 62rem; margin: 2rem auto; padding: 0 1.25rem; font-family: system-ui; }
    header, .acciones { display: flex; justify-content: space-between; gap: .7rem; align-items: center; }
    form { display: grid; gap: .7rem; max-width: 20rem; }
    input, button { font: inherit; padding: .5rem .7rem; }
    button { cursor: pointer; }
    .pedidos { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); }
    article { padding: 1rem; border: 1px solid #d6dfd8; border-radius: .65rem; }
    h2 { font-size: 1.15rem; }
    .estado { display: inline-block; margin: 0; padding: .2rem .55rem; border-radius: .4rem; background: #edf0ff; }
    .estado[data-estado=PREPARANDO] { background: #fff2cc; }
    .estado[data-estado=LISTO] { background: #ddf4e5; }
    .error { color: #9c1d23; }
  `],
})
export class PedidosPersonalComponent {
  private readonly http = inject(HttpClient);
  readonly rol = inject(ActivatedRoute).snapshot.data['rol'] === 'mesero' ? 'mesero' : 'cocina';
  readonly titulo = this.rol === 'mesero' ? 'Mesero' : 'Cocina';
  private readonly api = `/api/${this.rol}/pedidos`;
  private token = '';

  readonly conectado = signal(false);
  readonly ocupado = signal(false);
  readonly pedidos = signal<Comanda[]>([]);
  readonly error = signal('');
  readonly confirmacion = signal('');
  readonly etiquetas: Record<Estado, string> = {
    RECIBIDO: 'Recibido', PREPARANDO: 'Preparando', LISTO: 'Listo',
  };

  constructor() {
    interval(10000).pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.conectado()) this.cargar();
    });
  }

  entrar(evento: Event, campo: HTMLInputElement): void {
    evento.preventDefault();
    if (this.ocupado() || !campo.value.trim()) return;
    this.token = campo.value.trim();
    campo.value = '';
    this.cargar();
  }

  salir(): void {
    this.token = '';
    this.conectado.set(false);
    this.pedidos.set([]);
    this.error.set('');
    this.confirmacion.set('');
  }

  cargar(): void {
    if (!this.token || this.ocupado()) return;
    this.ocupado.set(true);
    this.http.get<Comanda[]>(this.api, this.opciones()).subscribe({
      next: pedidos => {
        this.pedidos.set(pedidos);
        this.error.set('');
        this.conectado.set(true);
        this.ocupado.set(false);
      },
      error: falla => this.mostrarFalla(falla),
    });
  }

  cambiar(pedido: Comanda, estado: Cambio): void {
    if (!this.conectado() || this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    this.confirmacion.set('');

    const destino = estado === 'ENTREGADO' ? 'entrega' : 'estado';
    const cuerpo = estado === 'ENTREGADO' ? null : { estado };

    this.http.patch<void>(
      `${this.api}/${pedido.idPedido}/${destino}`, cuerpo, this.opciones(),
    ).subscribe({
      next: () => {
        if (estado === 'ENTREGADO') {
          this.pedidos.update(lista => lista.filter(p => p.idPedido !== pedido.idPedido));
          this.confirmacion.set(`Pedido #${pedido.idPedido} entregado a la mesa ${pedido.mesa}.`);
        } else {
          this.pedidos.update(lista => lista.map(p =>
            p.idPedido === pedido.idPedido ? { ...p, estado } : p,
          ));
        }
        this.ocupado.set(false);
      },
      error: falla => this.mostrarFalla(falla),
    });
  }

  private opciones() {
    return { headers: { Authorization: `Bearer ${this.token}` }, timeout: 10000 };
  }

  private mostrarFalla(falla: HttpErrorResponse): void {
    this.ocupado.set(false);
    if (falla.status === 401) {
      this.salir();
      this.error.set(`La clave de ${this.rol} no es válida.`);
    } else if (falla.status === 503) {
      this.error.set(`Revisa que Spring Boot tenga la clave de ${this.rol} configurada.`);
    } else if (falla.status === 409) {
      this.error.set('El pedido cambió de estado. Actualiza la lista.');
    } else {
      this.error.set('No se pudieron cargar o actualizar los pedidos. Vuelve a intentar.');
    }
  }
}