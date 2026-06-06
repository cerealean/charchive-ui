import { Routes } from '@angular/router';

import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./auth/account/account').then((m) => m.AccountComponent),
  },
];
