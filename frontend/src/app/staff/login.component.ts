import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { mensajeError } from '../core/error.util';

@Component({standalone:true, selector:'app-login', imports:[ReactiveFormsModule,RouterLink], templateUrl:'./login.component.html'})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', Validators.required]
  });
  error = '';
  enviando = false;

  ingresar(): void {
    if (this.form.invalid || this.enviando) { this.form.markAllAsTouched(); return; }
    this.enviando = true;
    this.error = '';
    const {username, password} = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: res => { this.enviando = false; void this.router.navigateByUrl(this.auth.inicioParaRol(res.rol)); },
      error: e => { this.enviando = false; this.error = mensajeError(e); }
    });
  }
}
