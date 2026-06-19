import { Routes } from '@angular/router';

import { mustBeLoggedIn } from './guards/must-be-logged-in.guard';
import { enforceUsernameCompletion } from './guards/username-completion.guard';

export const routes: Routes = [
  {
    path: '',
    canActivateChild: [enforceUsernameCompletion],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/cards/cards').then((m) => m.CardsComponent),
      },
      {
        path: 'login',
        loadComponent: () => import('./components/login/login').then((m) => m.LoginComponent),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./components/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
      },
      {
        path: 'my',
        canActivate: [mustBeLoggedIn],
        children: [
          {
            path: 'username',
            loadComponent: () =>
              import('./components/username-setup/username-setup').then(
                (m) => m.UsernameSetupComponent,
              ),
          },
          {
            path: 'cards',
            loadComponent: () =>
              import('./components/my-cards/my-cards').then((m) => m.MyCardsComponent),
          },
          {
            path: 'account',
            loadComponent: () =>
              import('./components/account/account').then((m) => m.AccountComponent),
          },
        ],
      },
      {
        path: 'cards',
        redirectTo: '',
        pathMatch: 'full',
      },
      {
        path: 'cards/:id',
        loadComponent: () =>
          import('./components/card-detail/card-detail').then((m) => m.CardDetailComponent),
      },
      {
        path: 'u/:username',
        loadComponent: () =>
          import('./components/user-profile/user-profile').then((m) => m.UserProfileComponent),
      },
    ],
  },
];
