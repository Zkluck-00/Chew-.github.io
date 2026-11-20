import { Injectable, signal } from '@angular/core';
import { ParamMap } from '@angular/router';

@Injectable({providedIn: 'root'})
export class MesaService {
  readonly mesa = signal<number>(Number(sessionStorage.getItem('chew_mesa') || 0));
  readonly token = signal<string>(sessionStorage.getItem('chew_qr_token') || '');

  desdeUrl(params: ParamMap): void {
    const mesa = params.get('mesa');
    const token = params.get('token');
    if (mesa && /^\d+$/.test(mesa) && Number(mesa) > 0) {
      this.mesa.set(Number(mesa));
      sessionStorage.setItem('chew_mesa', mesa);
    }
    if (token) {
      this.token.set(token);
      sessionStorage.setItem('chew_qr_token', token);
    }
  }
  valida(): boolean { return this.mesa() > 0 && this.token().trim().length > 0; }
}
