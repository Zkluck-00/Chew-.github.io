import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { CarritoService } from '../core/carrito.service';
import { MesaService } from '../core/mesa.service';
import { ProductoMenu } from '../core/models';
import { mensajeError } from '../core/error.util';

@Component({standalone: true, selector: 'app-menu', imports: [CommonModule, FormsModule, RouterLink], templateUrl: './menu.component.html'})
export class MenuComponent implements OnInit {
  private api = inject(ApiService);
  private ruta = inject(ActivatedRoute);
  private destroyed = inject(DestroyRef);
  readonly carrito = inject(CarritoService);
  readonly mesa = inject(MesaService);
  productos: ProductoMenu[] = [];
  cargando = false;
  error = '';
  mensaje = '';
  buscar = '';
  categoria = 'todas';
  observaciones: Record<string, string> = {};

  ngOnInit(): void {
    this.ruta.queryParamMap.pipe(takeUntilDestroyed(this.destroyed)).subscribe(params => this.mesa.desdeUrl(params));
    this.recargar();
  }
  recargar(): void {
    this.cargando = true;
    this.error = '';
    forkJoin({platos: this.api.platos(), bebidas: this.api.bebidas()})
      .pipe(takeUntilDestroyed(this.destroyed))
      .subscribe({
        next: ({platos, bebidas}) => {
          this.productos = [
            ...platos.map(p => ({idProducto:p.idPlato, tipoProducto:'plato' as const, nombre:p.nombre,
              descripcion:p.descripcion || '', categoria:p.categoria || 'Platos', precio:Number(p.precio), imagen:p.imagen || ''})),
            ...bebidas.map(b => ({idProducto:b.idBebida, tipoProducto:'bebida' as const, nombre:b.nombre,
              descripcion:b.descripcion || '', categoria:b.categoria || 'Bebidas', precio:Number(b.precio), imagen:b.imagen || ''}))
          ];
          this.cargando = false;
        },
        error: e => { this.error = mensajeError(e); this.cargando = false; }
      });
  }
  get categorias(): string[] { return [...new Set(this.productos.map(p => p.categoria))].sort(); }
  get filtrados(): ProductoMenu[] {
    const q = this.buscar.trim().toLowerCase();
    return this.productos.filter(p => (this.categoria === 'todas' || p.categoria === this.categoria)
      && (!q || `${p.nombre} ${p.descripcion} ${p.categoria}`.toLowerCase().includes(q)));
  }
  clave(p: ProductoMenu): string { return `${p.tipoProducto}-${p.idProducto}`; }
  agregar(p: ProductoMenu): void {
    if (!this.mesa.valida()) {
      this.mensaje = 'Para confirmar el pedido escanea el QR de tu mesa. Puedes explorar el menu sin el QR.';
    }
    const observacion = (this.observaciones[this.clave(p)] || '').trim().slice(0, 500);
    if (!this.carrito.agregar(p, observacion)) {
      this.mensaje = 'El maximo es 7 productos por pedido.';
      return;
    }
    this.mensaje = `${p.nombre} agregado al carrito.`;
    this.observaciones[this.clave(p)] = '';
  }
  imagenValida(url: string): string {
    if (url?.startsWith('https://') || url?.startsWith('http://') || url?.startsWith('/')) return url;
    return '/chew-logo.png';
  }
}
