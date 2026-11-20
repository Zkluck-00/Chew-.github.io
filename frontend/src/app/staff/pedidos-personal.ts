import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { interval } from 'rxjs';
import { CobrosMesaComponent } from './cobros-mesa';
import { AuthService } from '../core/auth.service';
import { MesasOperacionComponent } from './mesas-operacion';

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
  imports: [CobrosMesaComponent, MesasOperacionComponent],
  template: `
    <main class="contenedor principal">
      @if (!conectado()) {
        <div class="login-layout">
          <section class="login-ilustracion" aria-labelledby="titulo-acceso">
            <p class="eyebrow">Chew</p>
            <h1 id="titulo-acceso">{{ titulo }}</h1>
          </section>
          <section class="panel login-panel" aria-labelledby="titulo-formulario">
            <h2 id="titulo-formulario">Acceso del personal</h2>
            <form (submit)="entrar($event, clave)">
              <label class="etiqueta" for="clave">Clave de {{ rol }}</label>
              <input class="campo ancho" #clave id="clave" type="password" required autocomplete="off">
              @if (error()) { <p class="alerta-error" role="alert">{{ error() }}</p> }
              <button class="btn ancho" type="submit" [disabled]="ocupado()">
                {{ ocupado() ? 'Verificando…' : 'Entrar' }}
              </button>
            </form>
          </section>
        </div>
      } @else {
        <header class="pagina-titulo cabecera-panel">
          <h1>{{ titulo }}</h1>
          <div class="acciones">
            <button class="btn btn-fantasma" type="button" [disabled]="ocupado()" (click)="cargar()">Actualizar</button>
            <button class="btn btn-fantasma" type="button" [disabled]="ocupado()" (click)="salir()">Salir</button>
          </div>
        </header>

        @if (error()) { <p class="alerta-error" role="alert">{{ error() }}</p> }
        @if (confirmacion()) { <p class="aviso" role="status">{{ confirmacion() }}</p> }

        <section [attr.aria-label]="'Pedidos de ' + rol" class="lista-pedidos">
          @for (pedido of pedidos(); track pedido.idPedido) {
            <article class="panel comanda">
              <p class="estado-chip" [attr.data-estado]="pedido.estado">{{ etiquetas[pedido.estado] }}</p>
              <h2>Pedido #{{ pedido.idPedido }} · Mesa {{ pedido.mesa }}</h2>
              <ul class="platos-comanda">
                @for (plato of pedido.platos; track $index) {
                  <li>{{ plato.cantidad }} × {{ plato.nombre }}</li>
                }
              </ul>
              @if (rol === 'cocina' && pedido.estado === 'RECIBIDO') {
                <button class="btn" type="button" [disabled]="ocupado()" (click)="cambiar(pedido, 'PREPARANDO')">
                  Empezar preparación
                </button>
              }
              @if (rol === 'cocina' && pedido.estado === 'PREPARANDO') {
                <button class="btn btn-verde" type="button" [disabled]="ocupado()" (click)="cambiar(pedido, 'LISTO')">
                  Marcar listo
                </button>
              }
              @if (rol === 'mesero' && pedido.estado === 'LISTO') {
                <button class="btn btn-verde" type="button" [disabled]="ocupado()" (click)="cambiar(pedido, 'ENTREGADO')">
                  Marcar entregado
                </button>
              }
            </article>
          } @empty {
            <p class="panel sin-pedidos" role="status">
              {{ rol === 'mesero' ? 'No hay pedidos listos para entregar.' : 'Aún no hay pedidos en cocina.' }}
            </p>
          }
        </section>

        @if (rol === 'mesero') {
          <app-cobros-mesa [token]="token" (sesionVencida)="salir()" />
          <app-mesas-operacion [token]="token" (sesionVencida)="salir()" (actualizacion)="actualizarCuentas()" />
        }
      }
    </main>
  `,
  styles: [`
    .login-ilustracion {
      display: flex;
      justify-content: center;
      flex-direction: column;
    }
    .login-panel { align-self: center; }
    .login-panel .alerta-error { margin-top: 1rem; }
    .cabecera-panel { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem; }
    .cabecera-panel .acciones { margin-top: 0; }
    .comanda h2 { font-size: 1.2rem; }
    .estado-chip[data-estado=PREPARANDO] { background: #fff2cc; }
    .estado-chip[data-estado=LISTO] { background: #ddf4e5; }
    .platos-comanda { padding-inline-start: 1rem; }
    .sin-pedidos { grid-column: 1 / -1; }
  `],
})
export class PedidosPersonalComponent {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly cobros = viewChild(CobrosMesaComponent);
  readonly rol = inject(ActivatedRoute).snapshot.data['rol'] === 'mesero' ? 'mesero' : 'cocina';
  readonly titulo = this.rol === 'mesero' ? 'Mesero' : 'Cocina';
  private readonly api = `/api/${this.rol}/pedidos`;
  protected token = '';

  readonly conectado = signal(false);
  readonly ocupado = signal(false);
  readonly pedidos = signal<Comanda[]>([]);
  readonly error = signal('');
  readonly confirmacion = signal('');
  readonly etiquetas: Record<Estado, string> = {
    RECIBIDO: 'Recibido', PREPARANDO: 'Preparando', LISTO: 'Listo',
  };

  constructor() {
    if (this.auth.rol() === 'ADMIN' || this.auth.rol()?.toLowerCase() === this.rol) {
      this.token = this.auth.token() ?? '';
      this.cargar();
    }
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

  actualizarCuentas(): void {
    this.cobros()?.cargar();
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
          this.cobros()?.cargar();
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
    } else if (falla.status === 403) {
      this.salir();
      this.error.set('Tu cuenta no tiene acceso a esta pantalla.');
    } else if (falla.status === 503) {
      this.error.set(`Revisa que Spring Boot tenga la clave de ${this.rol} configurada.`);
    } else if (falla.status === 409) {
      this.error.set('El pedido cambió de estado. Actualiza la lista.');
    } else {
      this.error.set('No se pudieron cargar o actualizar los pedidos. Vuelve a intentar.');
    }
  }
}
