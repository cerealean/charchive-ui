import { Routes } from '@angular/router';

import { mustBeLoggedIn } from './auth/guards/must-be-logged-in.guard';

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
    canActivate: [mustBeLoggedIn],
    loadComponent: () => import('./auth/account/account').then((m) => m.AccountComponent),
  },
];
