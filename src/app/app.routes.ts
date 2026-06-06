import { Routes } from '@angular/router';

import { mustBeLoggedIn } from './guards/must-be-logged-in.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'my',
    canActivate: [mustBeLoggedIn],
    children: [
      {
        path: 'account',
        loadComponent: () => import('./components/account/account').then((m) => m.AccountComponent),
      },
    ],
  },
];
