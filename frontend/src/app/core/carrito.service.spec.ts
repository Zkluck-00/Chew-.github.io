import { beforeEach, describe, expect, it } from 'vitest';
import { CarritoService } from './carrito.service';
import { ProductoMenu } from './models';

const plato: ProductoMenu = {idProducto:1,tipoProducto:'plato',nombre:'Ceviche de prueba',
  descripcion:'',categoria:'Platos',precio:29,imagen:''};

describe('Carrito de Chew', () => {
  beforeEach(() => localStorage.clear());
  it('agrega un producto y calcula el total', () => {
    const carrito = new CarritoService();
    expect(carrito.agregar(plato)).toBe(true);
    expect(carrito.cantidad()).toBe(1);
    expect(carrito.total()).toBe(29);
  });
  it('impide registrar un octavo producto', () => {
    const carrito = new CarritoService();
    for (let i=0;i<7;i++) expect(carrito.agregar(plato)).toBe(true);
    expect(carrito.agregar(plato)).toBe(false);
    expect(carrito.cantidad()).toBe(7);
  });
  it('vaciar elimina el pedido guardado', () => {
    const carrito = new CarritoService();
    carrito.agregar(plato);
    carrito.vaciar();
    expect(carrito.cantidad()).toBe(0);
  });
});
