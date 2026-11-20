import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { interval } from 'rxjs';

type Metodo = 'EFECTIVO' | 'TARJETA' | 'YAPE';

interface Cuenta {
  idMesa: number;
  mesa: number;
  idPedidos: number[];
  pendientesEntrega: number;
  total: number;
}

interface Recibo {
  idCobro: number;
  mesa: number;
  idPedidos: number[];
  metodo: Metodo;
  total: number;
}

interface Solicitud {
  idSolicitud: string;
  idPedidos: number[];
  metodo: Metodo;
  confirmado: true;
}

@Component({
  selector: 'app-cobros-mesa',
  imports: [CurrencyPipe, FormsModule],
  template: `
    <section class="cobros" aria-labelledby="titulo-cobros">
      <header>
        <h2 id="titulo-cobros">Cobros por mesa</h2>
        <button class="btn btn-fantasma" type="button" (click)="cargar()" [disabled]="ocupado() || !!seleccion()">
          Actualizar cuentas
        </button>
      </header>

      @if (error()) { <p role="alert" class="alerta-error">{{ error() }}</p> }
      @if (recibo(); as pago) {
        <p class="panel aviso recibo" role="status">
          Cobro #{{ pago.idCobro }} registrado · Mesa {{ pago.mesa }} ·
          {{ pago.total | currency:'PEN':'S/ ' }} · {{ etiquetas[pago.metodo] }}.
        </p>
      }

      @if (seleccion(); as cuenta) {
        <form class="panel panel-cobro" (ngSubmit)="registrar()">
          <h3>Confirmar cobro · Mesa {{ cuenta.mesa }}</h3>
          <p>Pedidos #{{ cuenta.idPedidos.join(', #') }} ·
            <strong>{{ cuenta.total | currency:'PEN':'S/ ' }}</strong></p>
          <label class="etiqueta" for="metodo-pago">Método de pago</label>
          <select class="campo" id="metodo-pago" name="metodo" required
            [ngModel]="metodo()" (ngModelChange)="metodo.set($event)"
            [disabled]="ocupado() || !!intento()">
            <option value="">Selecciona un método</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="YAPE">Yape</option>
          </select>
          <label class="checkbox">
            <input type="checkbox" name="confirmado" required
              [ngModel]="confirmado()" (ngModelChange)="confirmado.set($event)"
              [disabled]="ocupado() || !!intento()">
            Confirmo que recibí el pago.
          </label>
          <div class="acciones">
            <button class="btn btn-verde" type="submit" [disabled]="ocupado() || !metodo() || !confirmado()">
              {{ intento() && !ocupado() ? 'Reintentar registro' : 'Registrar cobro' }}
            </button>
            <button class="btn btn-fantasma" type="button" (click)="cerrar()" [disabled]="ocupado()">Cancelar</button>
          </div>
        </form>
      } @else {
        <ul class="cuentas-grid" aria-label="Cuentas pendientes">
          @for (cuenta of cuentas(); track cuenta.idMesa) {
            <li class="panel cuenta">
              <h3>Mesa {{ cuenta.mesa }}</h3>
              <p>Pedidos #{{ cuenta.idPedidos.join(', #') }} ·
                <strong>{{ cuenta.total | currency:'PEN':'S/ ' }}</strong></p>
              @if (cuenta.pendientesEntrega) {
                <p>Pendientes de entrega: {{ cuenta.pendientesEntrega }}</p>
              }
              <button class="btn" type="button" (click)="abrir(cuenta)"
                [disabled]="ocupado() || cuenta.pendientesEntrega > 0"
                [attr.aria-label]="'Cobrar mesa ' + cuenta.mesa">Cobrar</button>
            </li>
          } @empty {
            <li class="panel sin-cuentas">{{ ocupado() ? 'Consultando cuentas…' : 'No hay cuentas pendientes.' }}</li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .cobros { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e8e6e1; }
    header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .7rem; }
    header h2 { margin-bottom: 0; }
    .cuentas-grid { padding: 0; list-style: none; }
    .sin-cuentas { grid-column: 1 / -1; }
    form { display: grid; gap: .7rem; max-width: 32rem; }
    form h3, form p, form .acciones, form .checkbox { margin: 0; }
    .recibo { margin-top: 1rem; }
  `],
})
export class CobrosMesaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = '/api/mesero/cuentas';

  readonly token = input.required<string>();
  readonly sesionVencida = output<void>();
  readonly cuentas = signal<Cuenta[]>([]);
  readonly seleccion = signal<Cuenta | null>(null);
  readonly metodo = signal<Metodo | ''>('');
  readonly confirmado = signal(false);
  readonly intento = signal<Solicitud | null>(null);
  readonly ocupado = signal(false);
  readonly error = signal('');
  readonly recibo = signal<Recibo | null>(null);
  readonly etiquetas: Record<Metodo, string> = { EFECTIVO: 'Efectivo', TARJETA: 'Tarjeta', YAPE: 'Yape' };

  ngOnInit(): void {
    this.cargar();
    interval(10000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cargar());
  }

  cargar(conservarAviso = false): void {
    if (this.ocupado() || this.seleccion()) return;
    this.ocupado.set(true);
    this.http.get<Cuenta[]>(this.api, this.opciones()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cuentas => {
        this.cuentas.set(cuentas);
        if (!conservarAviso) this.error.set('');
        this.ocupado.set(false);
      },
      error: falla => this.mostrarFalla(falla),
    });
  }

  abrir(cuenta: Cuenta): void {
    if (this.ocupado() || cuenta.pendientesEntrega > 0) return;
    this.error.set('');
    this.recibo.set(null);
    this.seleccion.set(cuenta);
  }

  cerrar(): void {
    this.seleccion.set(null);
    this.metodo.set('');
    this.confirmado.set(false);
    this.intento.set(null);
  }

  registrar(): void {
    const cuenta = this.seleccion();
    const metodo = this.metodo();
    if (!cuenta || !metodo || !this.confirmado() || this.ocupado()) return;

    const solicitud = this.intento() ?? {
      idSolicitud: crypto.randomUUID(), idPedidos: cuenta.idPedidos, metodo, confirmado: true as const,
    };
    this.intento.set(solicitud);
    this.error.set('');
    this.ocupado.set(true);

    this.http.post<Recibo>(`${this.api}/${cuenta.idMesa}/cobros`, solicitud, this.opciones())
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: recibo => {
          this.cerrar();
          this.recibo.set(recibo);
          this.cuentas.update(cuentas => cuentas.filter(c => c.idMesa !== cuenta.idMesa));
          this.ocupado.set(false);
          this.cargar();
        },
        error: falla => {
          if (falla.status === 409) {
            this.cerrar();
            this.mostrarFalla(falla);
            this.cargar(true);
          } else {
            this.mostrarFalla(falla);
          }
        },
      });
  }

  private opciones() {
    return { headers: { Authorization: `Bearer ${this.token()}` }, timeout: 10000 };
  }

  private mostrarFalla(falla: HttpErrorResponse): void {
    this.ocupado.set(false);
    if (falla.status === 401) {
      this.sesionVencida.emit();
      return;
    }
    this.error.set(falla.status === 409
      ? 'La cuenta cambió. Revisa los pedidos antes de cobrar.'
      : this.seleccion()
        ? 'El cobro quedó sin confirmar. Reintenta para recuperar el resultado del mismo envío.'
        : 'No se pudieron consultar las cuentas pendientes.');
  }
}
