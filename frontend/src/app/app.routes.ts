import { Routes } from '@angular/router';
import { roleGuard } from './core/auth.guard';
import { MenuComponent } from './cliente/menu.component';
import { ResumenComponent } from './cliente/resumen.component';
import { PedidosClienteComponent } from './cliente/pedidos-cliente.component';
import { LoginComponent } from './staff/login.component';
import { AdminComponent } from './staff/admin.component';
import { CocinaComponent } from './staff/pedidos-personal';
import { MeseroComponent } from './staff/mesero.component';

export const routes: Routes = [
  {path: '', pathMatch: 'full', redirectTo: 'menu'},
  {path: 'menu', component: MenuComponent, title: 'Carta | Chew'},
  {path: 'resumen', component: ResumenComponent, title: 'Confirmar pedido | Chew'},
  {path: 'mis-pedidos', component: PedidosClienteComponent, title: 'Mis pedidos | Chew'},
  {path: 'ingresar', component: LoginComponent, title: 'Acceso personal | Chew'},
  {path: 'admin', component: AdminComponent, canActivate: [roleGuard('ADMIN')], title: 'Administrador | Chew'},
  {path: 'cocina', component: CocinaComponent, canActivate: [roleGuard('COCINA', 'ADMIN')], title: 'Cocina | Chew'},
  {path: 'mesero', component: MeseroComponent, canActivate: [roleGuard('MESERO', 'ADMIN')], title: 'Mesero | Chew'},
  {path: 'sin-acceso', title: 'Sin acceso | Chew', loadComponent: () => import('./staff/sin-acceso.component').then(m => m.SinAccesoComponent)},
  {path: '**', redirectTo: 'menu'}
];
