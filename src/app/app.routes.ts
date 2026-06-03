import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app').then((m) => m.App),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/auth/auth').then((m) => m.AuthComponent),
  },
  {
    path: 'account',
    loadComponent: () => import('./auth/account/account').then((m) => m.AccountComponent),
  },
];
