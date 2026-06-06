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
        path: 'cards',
        loadComponent: () =>
          import('./components/my-cards/my-cards').then((m) => m.MyCardsComponent),
      },
      {
        path: 'account',
        loadComponent: () => import('./components/account/account').then((m) => m.AccountComponent),
      },
    ],
  },
  {
    path: 'cards/:id',
    loadComponent: () =>
      import('./components/card-detail/card-detail').then((m) => m.CardDetailComponent),
  },
];
