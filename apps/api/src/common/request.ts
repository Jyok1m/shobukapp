import type { Request } from 'express';
import type { SelfUser } from './self-user';

export interface AuthenticatedRequest extends Request {
  user: SelfUser;
  sessionToken: string;
}
