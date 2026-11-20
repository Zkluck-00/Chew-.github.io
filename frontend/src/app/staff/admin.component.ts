import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Plato, Rol, Usuario } from '../core/models';
import { mensajeError } from '../core/error.util';

@Component({
  selector: 'app-admin',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyed = inject(DestroyRef);
  readonly auth = inject(AuthService);

  idActual: number | null = null;
  platos: Plato[] = [];
  usuarios: Usuario[] = [];
  tab: 'catalogo' | 'personal' | 'mesas' = 'catalogo';
  codigos: { numero: number; token: string }[] = [];
  readonly enlace = signal('');
  readonly qr = signal('');
  filtro = '';
  error = '';
  mensaje = '';
  guardando = false;
  cargando = false;

  readonly productoForm = this.fb.nonNullable.group({
    codigoPlato: ['', [Validators.required, Validators.maxLength(40)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    nombreCarta: ['', Validators.maxLength(100)],
    descripcion: ['', Validators.maxLength(500)],
    categoria: ['', [Validators.required, Validators.maxLength(80)]],
    precio: [1, [Validators.required, Validators.min(0.01), Validators.max(99999999.99)]],
    activo: [true],
    imagen: ['', [Validators.maxLength(2048), Validators.pattern(/^https:\/\/.+/)]],
  });

  readonly usuarioForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]{3,80}$/)]],
    password: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(72)]],
    rol: ['MESERO' as Rol, Validators.required],
  });

  get filtrados(): Plato[] {
    const texto = this.filtro.trim().toLocaleLowerCase('es');
    return this.platos.filter(plato =>
      [plato.codigoPlato, plato.nombre, plato.categoria].some(valor => valor.toLocaleLowerCase('es').includes(texto)),
    );
  }

  get productosActivos(): number {
    return new Set(this.platos.filter(plato => plato.activo).map(plato => plato.grupoCatalogo ?? plato.idPlato)).size;
  }

  get categoriasActivas(): number {
    return new Set(this.platos.filter(plato => plato.activo).map(plato => plato.categoria)).size;
  }

  get personalActivo(): number {
    return this.usuarios.filter(usuario => usuario.activo).length;
  }

  ngOnInit(): void {
    this.recargar();
  }

  recargar(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    forkJoin({ platos: this.api.platos(false), usuarios: this.api.usuarios() })
      .pipe(takeUntilDestroyed(this.destroyed), finalize(() => this.changeDetector.markForCheck()))
      .subscribe({
        next: ({ platos, usuarios }) => {
          this.platos = platos;
          this.usuarios = usuarios;
          this.cargando = false;
        },
        error: error => {
          this.cargando = false;
          this.error = mensajeError(error);
        },
      });
  }

  verMesas(): void {
    this.tab = 'mesas';
    this.error = '';
    this.api.codigosMesa().pipe(takeUntilDestroyed(this.destroyed), finalize(() => this.changeDetector.markForCheck())).subscribe({
      next: mesas => { this.codigos = mesas; },
      error: error => { this.error = mensajeError(error); },
    });
  }

  async mostrarQr(numero: string): Promise<void> {
    const mesa = this.codigos.find(codigo => codigo.numero === Number(numero));
    this.qr.set('');
    this.enlace.set('');
    if (!mesa) return;
    const url = new URL('/', window.location.origin);
    url.searchParams.set('mesa', String(mesa.numero));
    url.searchParams.set('token', mesa.token);
    const enlace = url.toString();
    this.enlace.set(enlace);
    try {
      const { default: codigoQr } = await import('qrcode');
      const imagen = await codigoQr.toDataURL(enlace, { width: 280, margin: 2 });
      if (this.enlace() === enlace) this.qr.set(imagen);
    } catch {
      if (this.enlace() === enlace) this.error = 'No se pudo generar el código QR.';
    }
  }

  nuevo(): void {
    this.idActual = null;
    this.productoForm.reset({ codigoPlato: '', nombre: '', nombreCarta: '', descripcion: '',
      categoria: '', precio: 1, activo: true, imagen: '' });
  }

  editar(plato: Plato): void {
    this.idActual = plato.idPlato;
    this.productoForm.reset({ codigoPlato: plato.codigoPlato, nombre: plato.nombre,
      nombreCarta: plato.nombreCarta ?? plato.nombre, descripcion: plato.descripcion ?? '',
      categoria: plato.categoria, precio: Number(plato.precio), activo: plato.activo, imagen: plato.imagen ?? '' });
    document.getElementById('p-nombre')?.focus();
  }

  guardarProducto(): void {
    if (this.productoForm.invalid || this.guardando) {
      this.productoForm.markAllAsTouched();
      return;
    }
    this.guardar(this.api.guardarProducto('platos', this.productoForm.getRawValue(), this.idActual ?? undefined),
      'Producto guardado.', () => this.nuevo());
  }

  desactivar(plato: Plato): void {
    if (this.guardando || !confirm(`¿Desactivar ${plato.nombre}?`)) return;
    this.guardar(this.api.desactivarProducto('platos', plato.idPlato), 'Producto desactivado.');
  }

  crearUsuario(): void {
    if (this.usuarioForm.invalid || this.guardando) {
      this.usuarioForm.markAllAsTouched();
      return;
    }
    this.guardar(this.api.crearUsuario(this.usuarioForm.getRawValue()), 'Usuario creado.',
      () => this.usuarioForm.reset({ username: '', password: '', rol: 'MESERO' }));
  }

  cambiarUsuario(usuario: Usuario, cambios: { rol?: Rol; activo?: boolean }): void {
    if (this.guardando || usuario.username === this.auth.usuario()) return;
    this.guardar(this.api.modificarUsuario(usuario.id, cambios), 'Permisos actualizados.');
  }

  actualizarRol(usuario: Usuario, rol: string): void {
    if (rol === 'ADMIN' || rol === 'MESERO' || rol === 'COCINA') this.cambiarUsuario(usuario, { rol });
  }

  private guardar(peticion: Observable<unknown>, mensaje: string, alGuardar?: () => void): void {
    this.guardando = true;
    this.error = '';
    this.mensaje = '';
    peticion.pipe(takeUntilDestroyed(this.destroyed), finalize(() => this.changeDetector.markForCheck())).subscribe({
      next: () => {
        this.guardando = false;
        this.mensaje = mensaje;
        alGuardar?.();
        this.recargar();
      },
      error: error => {
        this.guardando = false;
        this.error = error.status === 409 ? 'El código o nombre de usuario ya existe.' : mensajeError(error);
      },
    });
  }
}
