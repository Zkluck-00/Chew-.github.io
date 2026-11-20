import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { Cuenta, PedidoGestion, Ticket } from '../core/models';
import { mensajeError } from '../core/error.util';

@Component({standalone:true,selector:'app-mesero',imports:[CommonModule,ReactiveFormsModule],templateUrl:'./mesero.component.html'})
export class MeseroComponent implements OnInit {
  private api=inject(ApiService);
  private fb=inject(FormBuilder);
  private destroyed=inject(DestroyRef);
  pedidos:PedidoGestion[]=[];cuentas:Cuenta[]=[];
  error='';mensaje='';cargando=false;accionando=false;
  cuentaSeleccionada:Cuenta|null=null;
  ticket:Ticket|null=null;
  readonly pagoForm=this.fb.nonNullable.group({
    metodo:['EFECTIVO' as 'EFECTIVO'|'TARJETA'|'YAPE',Validators.required],
    confirmar:[false,Validators.requiredTrue]
  });
  ngOnInit():void {
    this.actualizar();
    interval(12000).pipe(takeUntilDestroyed(this.destroyed)).subscribe(()=>{if(!document.hidden && !this.cuentaSeleccionada) this.actualizar();});
  }
  actualizar():void {
    if(this.cargando || this.accionando)return;
    this.cargando=true;
    forkJoin({pedidos:this.api.pedidosMesero(),cuentas:this.api.cuentas()}).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:r=>{this.pedidos=r.pedidos;this.cuentas=r.cuentas;this.cargando=false;},
      error:e=>{this.error=mensajeError(e);this.cargando=false;}
    });
  }
  listos(p:PedidoGestion):boolean {return p.estado==='listo' && p.productos.length>0 && p.productos.every(i=>i.estadoCocina==='listo');}
  entregar(id:number):void {
    if(this.accionando)return;
    this.accionando=true;this.error='';this.mensaje='';
    this.api.entregarPedido(id).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:()=>{this.accionando=false;this.mensaje='Pedido entregado a la mesa.';this.actualizar();},
      error:e=>{this.accionando=false;this.error=mensajeError(e);}
    });
  }
  abrirCobro(cuenta:Cuenta):void {this.cuentaSeleccionada=cuenta;this.ticket=null;this.pagoForm.reset({metodo:'EFECTIVO',confirmar:false});}
  cerrarCobro():void {this.cuentaSeleccionada=null;this.ticket=null;}
  cobrar():void {
    if(!this.cuentaSeleccionada || !this.cuentaSeleccionada.cobrable || this.pagoForm.invalid || this.accionando) {
      this.pagoForm.markAllAsTouched();return;
    }
    this.accionando=true;this.error='';this.mensaje='';
    const id=this.cuentaSeleccionada.idGrupoMesa;
    this.api.cobrar(id,this.pagoForm.getRawValue().metodo).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:ticket=>{this.ticket=ticket;this.cuentaSeleccionada=null;this.accionando=false;this.mensaje='Pago registrado. Comprobante generado.';this.actualizar();},
      error:e=>{this.accionando=false;this.error=mensajeError(e);}
    });
  }
  imprimir():void {window.print();}
  get listosParaEntregar():PedidoGestion[]{return this.pedidos.filter(p=>this.listos(p));}
}
