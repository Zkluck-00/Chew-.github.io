import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

export type EstadoPedido = 'RECIBIDO' | 'PREPARANDO' | 'LISTO';
export type FiltroEstado = 'TODOS' | 'RECIBIDO' | 'PREPARANDO' | 'LISTO';

export interface PlatoComanda {
  nombre: string;
  cantidad: number;
  observacion?: string;
  opciones?: string[];
}

export interface Comanda {
  idPedido: number;
  mesa: number;
  estado: EstadoPedido;
  platos: PlatoComanda[];
}

const STORAGE_TOKEN_KEY = 'chew_cocina_token';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cocina.component.html',
  styleUrls: ['./cocina.component.scss']
})
export class CocinaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiBase = '/api/cocina/pedidos';

  // Signals reactivos
  readonly token = signal<string>(sessionStorage.getItem(STORAGE_TOKEN_KEY) || 'cocina123');
  readonly conectado = signal<boolean>(false);
  readonly cargando = signal<boolean>(false);
  readonly accionandoId = signal<number | null>(null);
  readonly pedidos = signal<Comanda[]>([]);
  readonly filtro = signal<FiltroEstado>('TODOS');
  readonly error = signal<string>('');
  readonly mensaje = signal<string>('');

  // Computeds
  readonly contadores = computed(() => {
    const lista = this.pedidos();
    return {
      total: lista.length,
      pendientes: lista.filter(p => p.estado === 'RECIBIDO').length,
      preparando: lista.filter(p => p.estado === 'PREPARANDO').length,
      listos: lista.filter(p => p.estado === 'LISTO').length,
    };
  });

  readonly pedidosFiltrados = computed(() => {
    const f = this.filtro();
    const lista = this.pedidos();
    if (f === 'TODOS') return lista;
    return lista.filter(p => p.estado === f);
  });

  constructor() {
    // Polling reactivo cada 10 segundos cuando está conectado
    interval(10000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.conectado() && !this.cargando() && this.accionandoId() === null) {
          this.cargar(true);
        }
      });
  }

  ngOnInit(): void {
    // Si ya existe un token almacenado, intenta conectar automáticamente
    if (this.token().trim()) {
      this.cargar();
    }
  }

  setFiltro(nuevoFiltro: FiltroEstado): void {
    this.filtro.set(nuevoFiltro);
  }

  entrar(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    const valor = input.value.trim();
    if (!valor) {
      this.error.set('Por favor ingresa la clave de cocina.');
      return;
    }
    this.token.set(valor);
    sessionStorage.setItem(STORAGE_TOKEN_KEY, valor);
    this.cargar();
  }

  salir(): void {
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    this.token.set('');
    this.conectado.set(false);
    this.pedidos.set([]);
    this.error.set('');
    this.mensaje.set('');
  }

  cargar(silencioso = false): void {
    const t = this.token().trim();
    if (!t) {
      this.conectado.set(false);
      return;
    }

    if (!silencioso) {
      this.cargando.set(true);
      this.error.set('');
    }

    this.http.get<Comanda[]>(this.apiBase, {
      headers: { Authorization: `Bearer ${t}` }
    }).subscribe({
      next: (data) => {
        this.pedidos.set(data || []);
        this.conectado.set(true);
        this.cargando.set(false);
        this.error.set('');
      },
      error: (err: HttpErrorResponse) => {
        this.cargando.set(false);
        this.manejarError(err);
      }
    });
  }

  cambiarEstado(pedido: Comanda, nuevoEstado: 'PREPARANDO' | 'LISTO'): void {
    if (this.accionandoId() !== null) return;

    // Validación de Frontend: regla de negocio de transiciones
    if (pedido.estado === 'RECIBIDO' && nuevoEstado !== 'PREPARANDO') {
      this.error.set('Un pedido recibido solo puede pasar a estado "En preparación".');
      return;
    }
    if (pedido.estado === 'PREPARANDO' && nuevoEstado !== 'LISTO') {
      this.error.set('Un pedido en preparación solo puede pasar a estado "Listo".');
      return;
    }

    this.accionandoId.set(pedido.idPedido);
    this.error.set('');
    this.mensaje.set('');

    const url = `${this.apiBase}/${pedido.idPedido}/estado`;
    const body = { estado: nuevoEstado };

    this.http.patch<void>(url, body, {
      headers: { Authorization: `Bearer ${this.token().trim()}` }
    }).subscribe({
      next: () => {
        this.pedidos.update(lista =>
          lista.map(p => p.idPedido === pedido.idPedido ? { ...p, estado: nuevoEstado } : p)
        );
        this.accionandoId.set(null);
        const accionTexto = nuevoEstado === 'PREPARANDO' ? 'puesto en preparación' : 'marcado como listo';
        this.mensaje.set(`Comanda #${pedido.idPedido} (Mesa ${pedido.mesa}) ${accionTexto}.`);

        // Limpiar mensaje tras 4 segundos
        setTimeout(() => {
          if (this.mensaje().includes(`#${pedido.idPedido}`)) {
            this.mensaje.set('');
          }
        }, 4000);
      },
      error: (err: HttpErrorResponse) => {
        this.accionandoId.set(null);
        this.manejarError(err);
      }
    });
  }

  private manejarError(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.conectado.set(false);
      this.error.set('Clave de acceso incorrecta. Verifica el token configurado en el backend.');
    } else if (err.status === 503) {
      this.error.set('El backend no tiene configurada la clave CHEW_COCINA_TOKEN.');
    } else if (err.status === 409) {
      this.error.set('Conflicto: El pedido ya fue modificado por otro usuario. Actualizando comandas...');
      this.cargar(true);
    } else if (err.status === 404) {
      this.error.set('El pedido solicitado no fue encontrado en la base de datos.');
      this.cargar(true);
    } else if (err.status === 0) {
      this.error.set('No se pudo conectar con el servidor backend. Asegúrate de que Spring Boot esté ejecutándose en el puerto 8081.');
    } else {
      this.error.set(`Error (${err.status}): ${err.message || 'Error inesperado al procesar la comanda.'}`);
    }
  }
}
