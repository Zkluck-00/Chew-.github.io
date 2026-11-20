export type Rol = 'ADMIN' | 'MESERO' | 'COCINA';
export type TipoProducto = 'plato' | 'bebida';
export interface OpcionPreparacion { nombre: string; grupo: string | null; }

export interface Plato {
  idPlato: number; codigoPlato: string; nombre: string; descripcion: string;
  categoria: string; precio: number; cantidadDePlatos: number; disponibleLlevar: boolean;
  activo: boolean; imagen: string;
  grupoCatalogo?: string | null; nombreCarta?: string | null; variante?: string | null;
  opciones?: OpcionPreparacion[];
}
export interface Bebida {
  idBebida: number; codigoBebida: string; nombre: string; descripcion: string;
  categoria: string; precio: number; cantidadDeBebidas: number; activo: boolean; imagen: string;
}
export interface ProductoMenu {
  idProducto: number; tipoProducto: TipoProducto; nombre: string; descripcion: string;
  categoria: string; precio: number; imagen: string;
}
export interface ItemCarrito extends ProductoMenu { cantidad: number; observacion: string; }
export interface PedidoItemRequest { tipoProducto: TipoProducto; idProducto: number; cantidad: number; observacion: string; }
export interface PedidoResponse {
  idPedido: number; numeroMesa: number; idGrupoMesa: number;
  codigo: string; estadoPedido: string; total: number;
}
export interface PedidoActual {
  id_pedido: number; codigo: string; estado_db: string; fecha: string; hora: string;
  total: number; productos: Array<{nombre: string; cantidad: number; precio: number;
    subtotal: number; observacion: string; estadoCocina: string}>;
}
export interface PedidoGestion {
  idPedido: number; codigo: string; mesa: number; idGrupoMesa: number; estado: string; total: number;
  productos: Array<{ idDetalleProducto: number; nombre: string; tipoProducto: string;
    cantidad: number; precioUnitario: number; subtotal: number; observacion: string; estadoCocina: string }>;
}
export interface Cuenta {
  idGrupoMesa: number; numeroMesa: number; pedidos: number;
  total: number; entregado: boolean; cobrable: boolean;
}
export interface Ticket {
  id: number; idGrupoMesa: number; numeroMesa: number; monto: number;
  metodo: string; registradoPor: string; fechaRegistro: string;
}
export interface Usuario { id: number; username: string; rol: Rol; activo: boolean; }
export interface LoginResponse { accessToken: string; tokenType: string; usuario: string; rol: Rol; expiraEn: string; }
