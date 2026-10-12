import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

function extract(req: any) {
  const h: string | undefined = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  return token;
}

/** Token majburiy */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = extract(req);
    const payload = token && this.auth.verify(token);
    if (!payload) throw new UnauthorizedException();
    req.user = payload;
    return true;
  }
}

/** Token bo'lsa o'qiydi, bo'lmasa mehmon sifatida o'tkazadi */
@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = extract(req);
    req.user = (token && this.auth.verify(token)) || null;
    return true;
  }
}
