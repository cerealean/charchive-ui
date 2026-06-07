import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth';
import { ProfileService } from '../services/profile';

const USERNAME_SETUP_PATH = '/my/username';
const AUTHENTICATED_HOME_PATH = '/my/cards';

export const enforceUsernameCompletion: CanActivateChildFn = async (_route, state) => {
  const auth = inject(AuthService);
  const profiles = inject(ProfileService);
  const router = inject(Router);
  const user = await auth.getUser();

  if (!user) {
    return true;
  }

  const hasUsername = await profiles.userHasUsername(user);
  const isUsernameSetupRoute = state.url === USERNAME_SETUP_PATH;

  if (!hasUsername && !isUsernameSetupRoute) {
    return router.createUrlTree([USERNAME_SETUP_PATH]);
  }

  if (hasUsername && isUsernameSetupRoute) {
    return router.createUrlTree([AUTHENTICATED_HOME_PATH]);
  }

  return true;
};
