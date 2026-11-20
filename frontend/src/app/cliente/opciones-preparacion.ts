import { Component, input, output } from '@angular/core';
import { OpcionPreparacion } from '../core/models';

@Component({
  selector: 'app-opciones-preparacion',
  template: `
    @if (opciones().length) {
      <details class="preparacion">
        <summary>Opciones de preparación
          @if (elegidas().length) { <span>({{ elegidas().length }})</span> }
        </summary>
        <fieldset>
          <legend>Elige hasta dos</legend>
          @for (opcion of opciones(); track opcion.nombre) {
            <label>
              <input type="checkbox" [checked]="elegidas().includes(opcion.nombre)"
                [disabled]="!disponible(opcion)" (change)="cambiar(opcion)" />
              {{ opcion.nombre }}
            </label>
          }
        </fieldset>
      </details>
    }
  `,
  styles: [`
    :host { display: block; }
    .preparacion { margin-top: .8rem; background: #fff7f0; border-radius: .65rem; padding: .65rem .75rem; }
    summary { font-size: .85rem; font-weight: 750; cursor: pointer; }
    fieldset { border: 0; margin: .5rem 0 0; padding: 0; min-inline-size: 0; }
    legend { font-size: .75rem; margin-bottom: .25rem; }
    label { display: flex; align-items: center; gap: .45rem; font-size: .85rem; min-height: 1.85rem; }
    input { flex-shrink: 0; accent-color: #ad491e; }
  `],
})
export class OpcionesPreparacionComponent {
  readonly opciones = input.required<OpcionPreparacion[]>();
  readonly elegidas = input.required<string[]>();
  readonly elegidasChange = output<string[]>();

  disponible(opcion: OpcionPreparacion): boolean {
    return this.elegidas().includes(opcion.nombre) || this.elegidas().length < 2
      || this.alternativa(opcion) !== undefined;
  }

  cambiar(opcion: OpcionPreparacion): void {
    const elegidas = this.elegidas();
    if (elegidas.includes(opcion.nombre)) {
      this.elegidasChange.emit(elegidas.filter(nombre => nombre !== opcion.nombre));
      return;
    }
    if (this.disponible(opcion)) {
      const reemplazo = this.alternativa(opcion);
      this.elegidasChange.emit([...elegidas.filter(nombre => nombre !== reemplazo), opcion.nombre].sort());
    }
  }

  private alternativa(opcion: OpcionPreparacion): string | undefined {
    if (!opcion.grupo) return;
    return this.opciones().find(otra => otra.grupo === opcion.grupo && this.elegidas().includes(otra.nombre))?.nombre;
  }
}
