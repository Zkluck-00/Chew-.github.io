import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({standalone:true, selector:'app-sin-acceso', imports:[RouterLink],
  template:`<section class="panel centrado"><h1>Acceso restringido</h1><p>Tu rol no tiene permiso para abrir esta seccion.</p><a class="btn" routerLink="/menu">Volver a la carta</a></section>`})
export class SinAccesoComponent {}
