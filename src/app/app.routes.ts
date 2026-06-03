import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app').then((m) => m.App),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'account',
    loadComponent: () => import('./auth/account/account').then((m) => m.AccountComponent),
  },
];
