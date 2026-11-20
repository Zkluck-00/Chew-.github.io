import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { interval, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { MesaService } from '../core/mesa.service';
import { PedidoActual } from '../core/models';
import { mensajeError } from '../core/error.util';

@Component({standalone:true, selector:'app-pedidos-cliente', imports:[CommonModule,RouterLink], templateUrl:'./pedidos-cliente.component.html'})
export class PedidosClienteComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private destroyed = inject(DestroyRef);
  readonly mesa = inject(MesaService);
  pedidos: PedidoActual[] = [];
  cargando = false;
  error = '';
  get pendiente(): number { return this.pedidos.reduce((s, p) => s + Number(p.total), 0); }
  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyed)).subscribe(q => {
      this.mesa.desdeUrl(q); this.actualizar();
    });
    interval(15000).pipe(takeUntilDestroyed(this.destroyed)).subscribe(() => {
      if (!document.hidden) this.actualizar();
    });
  }
  actualizar(): void {
    if (!this.mesa.valida() || this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.api.pedidosMesa(this.mesa.mesa(), this.mesa.token())
      .pipe(takeUntilDestroyed(this.destroyed)).subscribe({
        next: r => { this.pedidos = (r.data || []).filter(p => !['pagado','cancelado'].includes(p.estado_db)); this.cargando = false; },
        error: e => { this.error = mensajeError(e); this.cargando = false; }
      });
  }
}
