import { Injectable, signal, computed } from '@angular/core';
import { ItemCarrito, ProductoMenu } from './models';

const KEY = 'chew_carrito_angular';
@Injectable({providedIn: 'root'})
export class CarritoService {
  readonly items = signal<ItemCarrito[]>(this.leer());
  readonly cantidad = computed(() => this.items().reduce((s, x) => s + x.cantidad, 0));
  readonly total = computed(() => this.items().reduce((s, x) => s + x.precio * x.cantidad, 0));

  agregar(producto: ProductoMenu, observacion = ''): boolean {
    if (this.cantidad() >= 7) return false;
    const lista = this.items().map(x => ({...x}));
    const item = lista.find(x => x.idProducto === producto.idProducto && x.tipoProducto === producto.tipoProducto && x.observacion === observacion);
    if (item) item.cantidad += 1;
    else lista.push({...producto, observacion, cantidad: 1});
    this.guardar(lista);
    return true;
  }
  modificar(indice: number, cambio: number): void {
    const lista = this.items().map(x => ({...x}));
    if (!lista[indice] || (cambio > 0 && this.cantidad() >= 7)) return;
    lista[indice].cantidad += cambio;
    this.guardar(lista.filter(x => x.cantidad > 0));
  }
  quitar(indice: number): void { this.guardar(this.items().filter((_, i) => i !== indice)); }
  vaciar(): void { this.guardar([]); }
  private guardar(items: ItemCarrito[]): void {
    this.items.set(items);
    localStorage.setItem(KEY, JSON.stringify(items));
  }
  private leer(): ItemCarrito[] {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || '[]') as ItemCarrito[];
      return Array.isArray(items) ? items.filter(x => x.cantidad > 0 && x.cantidad <= 7) : [];
    } catch { return []; }
  }
}
