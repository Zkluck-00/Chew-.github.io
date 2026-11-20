import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { interval, Observable } from 'rxjs';
import { Plato } from '../core/models';

interface Mesa {
  numero: number;
  principal: number;
  ocupada: boolean;
}

@Component({
  selector: 'app-mesas-operacion',
  imports: [CurrencyPipe],
  template: `
    <section class="seccion" aria-labelledby="titulo-mesas">
      <header class="barra-seccion">
        <h2 id="titulo-mesas">Mesas</h2>
        <button type="button" class="btn btn-fantasma" [disabled]="ocupado()" (click)="cargar()">Actualizar mesas</button>
      </header>
      @if (error()) { <p class="alerta-error" role="alert">{{ error() }}</p> }
      @if (mensaje()) { <p class="aviso" role="status">{{ mensaje() }}</p> }
      <div class="cuentas-grid">
        @for (mesa of mesas(); track mesa.numero) {
          <article class="panel">
            <h3>Mesa {{ mesa.numero }}</h3>
            <p [class.aviso]="mesa.ocupada">{{ mesa.ocupada ? 'Ocupada' : 'Libre' }}</p>
            @if (mesa.principal !== mesa.numero) { <p>Unida a mesa {{ mesa.principal }}</p> }
            <button type="button" class="btn btn-pequeno" [disabled]="ocupado()" (click)="iniciar(mesa.numero)">
              Tomar pedido
            </button>
          </article>
        } @empty {
          <p>{{ ocupado() ? 'Consultando mesas…' : 'No se encontraron mesas activas.' }}</p>
        }
      </div>

      <div class="dos-columnas seccion">
        @if (mesaActual(); as numero) {
          <form class="panel" (submit)="enviar($event)">
            <h3>Pedido manual · Mesa {{ numero }}</h3>
            <label class="etiqueta" for="plato-manual">Producto o presentación</label>
            <select id="plato-manual" class="campo ancho" #plato>
              @for (producto of platos(); track producto.idPlato) {
                <option [value]="producto.idPlato">{{ producto.nombre }} · {{ producto.precio | currency:'PEN':'S/ ' }}</option>
              }
            </select>
            <button class="btn btn-fantasma" type="button" (click)="agregar(plato.value)"
              [disabled]="ocupado() || unidades() >= 7 || platos().length === 0">Agregar producto</button>
            @for (item of seleccion(); track item.idPlato) {
              <div class="fila-item">
                <span>{{ item.cantidad }} × {{ item.nombre }}</span>
                <button class="btn btn-pequeno btn-fantasma" type="button" [disabled]="ocupado()"
                  [attr.aria-label]="'Quitar una unidad de ' + item.nombre" (click)="cambiar(item.idPlato, -1)">−</button>
              </div>
            }
            <div class="fila-total"><span>Unidades</span><strong>{{ unidades() }} de 7</strong></div>
            <div class="acciones">
              <button type="submit" class="btn" [disabled]="ocupado() || unidades() === 0">Enviar a cocina</button>
              <button type="button" class="btn btn-fantasma" [disabled]="ocupado()" (click)="cerrar()">Cerrar</button>
            </div>
          </form>
        }
        <form class="panel" (submit)="unir($event, principal.value, secundaria.value)">
          <h3>Unir mesas</h3>
          <label class="etiqueta" for="mesa-principal">Mesa principal</label>
          <select id="mesa-principal" #principal class="campo ancho" required>
            <option value="">Selecciona una mesa</option>
            @for (mesa of principales(); track mesa.numero) { <option [value]="mesa.numero">{{ mesa.numero }}</option> }
          </select>
          <label class="etiqueta" for="mesa-secundaria">Mesa que se une</label>
          <select id="mesa-secundaria" #secundaria class="campo ancho" required>
            <option value="">Selecciona una mesa</option>
            @for (mesa of principales(); track mesa.numero) { <option [value]="mesa.numero">{{ mesa.numero }}</option> }
          </select>
          <div class="acciones"><button type="submit" class="btn" [disabled]="ocupado()">Unir mesas</button></div>
          @for (mesa of grupos(); track mesa.numero) {
            <div class="fila-item">
              <span>Grupo de mesa {{ mesa.numero }}</span>
              <button class="btn btn-pequeno btn-fantasma" type="button" [disabled]="ocupado() || mesa.ocupada"
                (click)="separar(mesa.numero)">Separar mesas</button>
            </div>
          }
        </form>
      </div>
    </section>
  `,
})
export class MesasOperacionComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly api = '/api/mesero/mesas';
  private solicitud: string | null = null;

  readonly token = input.required<string>();
  readonly actualizacion = output<void>();
  readonly sesionVencida = output<void>();
  readonly mesas = signal<Mesa[]>([]);
  readonly mesaActual = signal<number | null>(null);
  readonly platos = signal<Plato[]>([]);
  readonly cant = signal<Record<number, number>>({});
  readonly ocupado = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly principales = computed(() => this.mesas().filter(mesa => mesa.numero === mesa.principal));
  readonly grupos = computed(() => {
    const uniones = new Set(this.mesas().filter(mesa => mesa.numero !== mesa.principal).map(mesa => mesa.principal));
    return this.principales().filter(mesa => uniones.has(mesa.numero));
  });
  readonly seleccion = computed(() => this.platos().flatMap(plato => {
    const cantidad = this.cant()[plato.idPlato];
    return cantidad ? [{ idPlato: plato.idPlato, nombre: plato.nombre, cantidad }] : [];
  }));
  readonly unidades = computed(() => this.seleccion().reduce((total, item) => total + item.cantidad, 0));

  ngOnInit(): void {
    this.cargar();
    interval(10000).pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.cargar());
  }

  cargar(): void {
    if (this.ocupado()) return;
    this.pedir(this.http.get<Mesa[]>(this.api, this.opciones()), mesas => this.mesas.set(mesas));
  }

  iniciar(mesa: number): void {
    this.cerrar();
    this.mesaActual.set(mesa);
    this.pedir(this.http.get<Plato[]>('/api/platos/activos'), platos => this.platos.set(platos));
  }

  cerrar(): void {
    this.mesaActual.set(null);
    this.cant.set({});
    this.solicitud = null;
  }

  agregar(valor: string): void {
    if (this.unidades() < 7) this.cambiar(Number(valor), 1);
  }

  cambiar(id: number, cambio: number): void {
    if (!this.platos().some(plato => plato.idPlato === id)) return;
    this.cant.update(actual => ({ ...actual, [id]: Math.max(0, (actual[id] ?? 0) + cambio) }));
    this.solicitud = null;
  }

  enviar(evento: Event): void {
    evento.preventDefault();
    const mesa = this.mesaActual();
    if (!mesa || !this.unidades() || this.ocupado()) return;
    this.solicitud ??= crypto.randomUUID();
    const items = this.seleccion().map(({ idPlato, cantidad }) => ({ idPlato, cantidad }));
    this.pedir(this.http.post<{ idPedido: number }>('/api/pedidos/manual',
      { mesa, idSolicitud: this.solicitud, items }, this.opciones()), recibo => {
      this.mensaje.set(`Pedido #${recibo.idPedido} enviado a cocina.`);
      this.cerrar();
      this.cargar();
      this.actualizacion.emit();
    });
  }

  unir(evento: Event, principal: string, secundaria: string): void {
    evento.preventDefault();
    if (!principal || !secundaria || principal === secundaria) {
      this.error.set('Selecciona dos mesas distintas.');
      return;
    }
    this.pedir(this.http.post<void>(this.api + '/uniones',
      { principal: Number(principal), secundaria: Number(secundaria) }, this.opciones()), () => this.agrupadas('Mesas unidas.'));
  }

  separar(numero: number): void {
    this.pedir(this.http.delete<void>(`${this.api}/${numero}/union`, this.opciones()), () => this.agrupadas('Mesas separadas.'));
  }

  private agrupadas(texto: string): void {
    this.mensaje.set(texto);
    this.cargar();
    this.actualizacion.emit();
  }

  private opciones() {
    return { headers: { Authorization: `Bearer ${this.token()}` } };
  }

  private pedir<T>(peticion: Observable<T>, respuesta: (dato: T) => void): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set('');
    peticion.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: dato => {
        this.ocupado.set(false);
        respuesta(dato);
      },
      error: (falla: HttpErrorResponse) => {
        this.ocupado.set(false);
        if (falla.status === 401) this.sesionVencida.emit();
        this.error.set(falla.status === 409
          ? 'La mesa o el catálogo cambió. Actualiza los datos e inténtalo nuevamente.'
          : 'No se pudo completar la operación.');
      },
    });
  }
}
