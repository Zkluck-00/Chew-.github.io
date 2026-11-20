import { beforeEach, describe, expect, it } from 'vitest';
import { convertToParamMap } from '@angular/router';
import { MesaService } from './mesa.service';

describe('Contexto QR de mesa', () => {
  beforeEach(() => sessionStorage.clear());
  it('identifica la mesa y exige token para confirmar pedidos', () => {
    const mesa = new MesaService();
    mesa.desdeUrl(convertToParamMap({mesa:'5'}));
    expect(mesa.valida()).toBe(false);
    mesa.desdeUrl(convertToParamMap({token:'token-ficticio-de-prueba'}));
    expect(mesa.mesa()).toBe(5);
    expect(mesa.valida()).toBe(true);
  });
});
