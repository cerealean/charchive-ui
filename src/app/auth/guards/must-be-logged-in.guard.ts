import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { SupabaseService } from '../services/supabase';

export const mustBeLoggedIn: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  const user = await supabase.getUser();

  return user ? true : router.createUrlTree(['/']);
};
