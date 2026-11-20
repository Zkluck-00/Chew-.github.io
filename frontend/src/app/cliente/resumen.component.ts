import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { CarritoService } from '../core/carrito.service';
import { MesaService } from '../core/mesa.service';
import { PedidoResponse } from '../core/models';
import { mensajeError } from '../core/error.util';

@Component({standalone:true, selector:'app-resumen', imports:[CommonModule, RouterLink], templateUrl:'./resumen.component.html'})
export class ResumenComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private destroyed = inject(DestroyRef);
  readonly carrito = inject(CarritoService);
  readonly mesa = inject(MesaService);
  enviando = false;
  error = '';
  resultado: PedidoResponse | null = null;

  ngOnInit(): void { this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyed)).subscribe(q => this.mesa.desdeUrl(q)); }

  enviar(): void {
    if (this.enviando) return;
    this.error = '';
    if (!this.mesa.valida()) { this.error = 'Falta la mesa o el token QR. Escanea nuevamente el codigo QR.'; return; }
    if (!this.carrito.cantidad() || this.carrito.cantidad() > 7) {
      this.error = 'El pedido debe contener entre 1 y 7 productos.';
      return;
    }
    this.enviando = true;
    const body = {
      numeroMesa: this.mesa.mesa(), tokenMesa: this.mesa.token(),
      items: this.carrito.items().map(x => ({tipoProducto:x.tipoProducto,
        idProducto:x.idProducto, cantidad:x.cantidad, observacion:x.observacion}))
    };
    this.api.crearPedido(body).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next: pedido => { this.resultado = pedido; this.carrito.vaciar(); this.enviando = false; },
      error: e => { this.error = mensajeError(e); this.enviando = false; }
    });
  }
}
