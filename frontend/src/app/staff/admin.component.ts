import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';
import { Bebida, Plato, Rol, Usuario } from '../core/models';
import { mensajeError } from '../core/error.util';

@Component({standalone:true, selector:'app-admin', imports:[CommonModule,ReactiveFormsModule], templateUrl:'./admin.component.html'})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private destroyed = inject(DestroyRef);
  tipo: 'platos' | 'bebidas' = 'platos';
  idActual: number | null = null;
  platos: Plato[] = [];
  bebidas: Bebida[] = [];
  usuarios: Usuario[] = [];
  tab: 'catalogo' | 'personal' = 'catalogo';
  error = '';
  mensaje = '';
  guardando = false;
  readonly productoForm = this.fb.nonNullable.group({
    codigo: ['', [Validators.required,Validators.maxLength(40)]],
    nombre: ['', [Validators.required,Validators.maxLength(100)]],
    descripcion: [''], categoria: [''], precio: [1, [Validators.required,Validators.min(0.01)]],
    cantidad: [0, [Validators.required,Validators.min(0)]],
    disponibleLlevar: [true], activo: [true], imagen: ['']
  });
  readonly usuarioForm = this.fb.nonNullable.group({
    username: ['', [Validators.required,Validators.minLength(3),Validators.maxLength(80)]],
    password: ['', [Validators.required,Validators.minLength(10)]],
    rol: ['MESERO' as Rol,Validators.required]
  });
  ngOnInit(): void { this.recargar(); }
  recargar(): void {
    this.error = '';
    forkJoin({platos:this.api.platos(false), bebidas:this.api.bebidas(false), usuarios:this.api.usuarios()})
      .pipe(takeUntilDestroyed(this.destroyed))
      .subscribe({next:r => {this.platos=r.platos;this.bebidas=r.bebidas;this.usuarios=r.usuarios;},
        error:e => this.error=mensajeError(e)});
  }
  seleccionarTipo(tipo: 'platos'|'bebidas'): void { this.tipo=tipo;this.nuevo(); }
  nuevo(): void {
    this.idActual=null;
    this.productoForm.reset({codigo:'',nombre:'',descripcion:'',categoria:'',precio:1,cantidad:0,disponibleLlevar:true,activo:true,imagen:''});
  }
  editar(p: Plato | Bebida): void {
    const esPlato = 'idPlato' in p;
    this.tipo=esPlato?'platos':'bebidas';
    this.idActual=esPlato?p.idPlato:p.idBebida;
    this.productoForm.reset({
      codigo:esPlato?p.codigoPlato:p.codigoBebida,
      nombre:p.nombre,descripcion:p.descripcion||'',categoria:p.categoria||'',precio:Number(p.precio),
      cantidad:esPlato?p.cantidadDePlatos:p.cantidadDeBebidas,
      disponibleLlevar:esPlato?p.disponibleLlevar:true,activo:p.activo,imagen:p.imagen||''
    });
    window.scrollTo({top:0,behavior:'smooth'});
  }
  guardarProducto(): void {
    if (this.productoForm.invalid || this.guardando) { this.productoForm.markAllAsTouched(); return; }
    this.error='';this.mensaje='';this.guardando=true;
    const v=this.productoForm.getRawValue();
    const base={nombre:v.nombre.trim(),descripcion:v.descripcion,categoria:v.categoria,
      precio:Number(v.precio),activo:v.activo,imagen:v.imagen};
    const body=this.tipo==='platos'
      ? {...base,codigoPlato:v.codigo.trim(),cantidadDePlatos:Number(v.cantidad),disponibleLlevar:v.disponibleLlevar}
      : {...base,codigoBebida:v.codigo.trim(),cantidadDeBebidas:Number(v.cantidad)};
    this.api.guardarProducto(this.tipo,body,this.idActual ?? undefined).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:() => {this.mensaje='Producto guardado correctamente.';this.guardando=false;this.nuevo();this.recargar();},
      error:e => {this.error=mensajeError(e);this.guardando=false;}
    });
  }
  desactivar(p: Plato | Bebida): void {
    const id='idPlato' in p?p.idPlato:p.idBebida;
    const tipo='idPlato' in p?'platos':'bebidas';
    if (!confirm(`¿Desactivar ${p.nombre}?`)) return;
    this.api.desactivarProducto(tipo,id).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:() => {this.mensaje='Producto desactivado.';this.recargar();},
      error:e => this.error=mensajeError(e)
    });
  }
  crearUsuario(): void {
    if (this.usuarioForm.invalid || this.guardando) { this.usuarioForm.markAllAsTouched(); return; }
    this.guardando=true;this.error='';this.mensaje='';
    this.api.crearUsuario(this.usuarioForm.getRawValue()).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:() => {this.guardando=false;this.mensaje='Usuario creado.';
        this.usuarioForm.reset({username:'',password:'',rol:'MESERO'});this.recargar();},
      error:e => {this.guardando=false;this.error=mensajeError(e);}
    });
  }
  cambiarUsuario(usuario:Usuario, data: {rol?:Rol;activo?:boolean}): void {
    this.error='';this.mensaje='';
    this.api.modificarUsuario(usuario.id,data).pipe(takeUntilDestroyed(this.destroyed)).subscribe({
      next:() => {this.mensaje='Permisos actualizados.';this.recargar();},error:e => this.error=mensajeError(e)
    });
  }
  actualizarRol(usuario:Usuario, value:string):void {
    if (value==='ADMIN'||value==='MESERO'||value==='COCINA') this.cambiarUsuario(usuario,{rol:value});
  }
}
