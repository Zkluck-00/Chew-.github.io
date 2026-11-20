import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Bebida, Cuenta, LoginResponse, PedidoActual, PedidoGestion, PedidoResponse, Plato, Ticket, Usuario } from './models';

const BASE = '/api';
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  platos(activos = true): Observable<Plato[]> { return this.http.get<Plato[]>(activos ? `${BASE}/platos/activos` : `${BASE}/admin/platos`); }
  bebidas(activas = true): Observable<Bebida[]> { return this.http.get<Bebida[]>(`${BASE}/bebidas${activas ? '/activas' : ''}`); }
  guardarProducto(tipo: 'platos' | 'bebidas', body: unknown, id?: number): Observable<unknown> {
    const url = `${BASE}/${tipo}${id ? `/${id}` : ''}`;
    return id ? this.http.put(url, body) : this.http.post(url, body);
  }
  desactivarProducto(tipo: 'platos' | 'bebidas', id: number): Observable<unknown> {
    return this.http.delete(`${BASE}/${tipo}/${id}`);
  }
  crearPedido(body: unknown): Observable<PedidoResponse> { return this.http.post<PedidoResponse>(`${BASE}/pedidos`, body); }
  pedidosMesa(mesa: number, token: string): Observable<{ok: boolean; data: PedidoActual[]}> {
    return this.http.get<{ok: boolean; data: PedidoActual[]}>(`${BASE}/pedidos/mesa/${mesa}`,
      { headers: new HttpHeaders({ 'X-Mesa-Token': token }) });
  }
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${BASE}/auth/login`, { username, password });
  }
  cerrarSesion(): Observable<void> { return this.http.delete<void>(`${BASE}/auth/sesion`); }
  codigosMesa(): Observable<{ numero: number; token: string }[]> { return this.http.get<{ numero: number; token: string }[]>(`${BASE}/admin/mesas`); }
  usuarios(): Observable<Usuario[]> { return this.http.get<Usuario[]>(`${BASE}/admin/usuarios`); }
  crearUsuario(body: unknown): Observable<Usuario> { return this.http.post<Usuario>(`${BASE}/admin/usuarios`, body); }
  modificarUsuario(id: number, body: unknown): Observable<Usuario> {
    return this.http.patch<Usuario>(`${BASE}/admin/usuarios/${id}`, body);
  }
  pedidosCocina(): Observable<PedidoGestion[]> { return this.http.get<PedidoGestion[]>(`${BASE}/cocina/pedidos`); }
  cambiarEstadoDetalle(id: number, estado: 'preparando' | 'listo'): Observable<unknown> {
    return this.http.patch(`${BASE}/cocina/detalles/${id}/estado`, { estado });
  }
  pedidosMesero(): Observable<PedidoGestion[]> { return this.http.get<PedidoGestion[]>(`${BASE}/mesero/pedidos`); }
  entregarPedido(id: number): Observable<unknown> { return this.http.patch(`${BASE}/mesero/pedidos/${id}/entregar`, {}); }
  cuentas(): Observable<Cuenta[]> { return this.http.get<Cuenta[]>(`${BASE}/mesero/cuentas`); }
  cobrar(idGrupoMesa: number, metodo: 'EFECTIVO' | 'TARJETA' | 'YAPE'): Observable<Ticket> {
    return this.http.post<Ticket>(`${BASE}/mesero/cuentas/${idGrupoMesa}/cobrar`, { metodo, confirmado: true });
  }
  comprobante(idGrupoMesa: number): Observable<Ticket> {
    return this.http.get<Ticket>(`${BASE}/mesero/cuentas/${idGrupoMesa}/comprobante`);
  }
}
