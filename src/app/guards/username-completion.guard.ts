import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { SupabaseService } from '../services/supabase';

const USERNAME_SETUP_PATH = '/my/username';
const AUTHENTICATED_HOME_PATH = '/my/cards';

export const enforceUsernameCompletion: CanActivateChildFn = async (_route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const user = await supabase.getUser();

  if (!user) {
    return true;
  }

  const hasUsername = await supabase.userHasUsername(user);
  const isUsernameSetupRoute = state.url === USERNAME_SETUP_PATH;

  if (!hasUsername && !isUsernameSetupRoute) {
    return router.createUrlTree([USERNAME_SETUP_PATH]);
  }

  if (hasUsername && isUsernameSetupRoute) {
    return router.createUrlTree([AUTHENTICATED_HOME_PATH]);
  }

  return true;
};
