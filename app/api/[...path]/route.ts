import { env } from 'cloudflare:workers';
import { handleApi } from '../../../lib/server/api';

export const dynamic = 'force-dynamic';
export function GET(request: Request) { return handleApi(request,env); }
export function POST(request: Request) { return handleApi(request,env); }
