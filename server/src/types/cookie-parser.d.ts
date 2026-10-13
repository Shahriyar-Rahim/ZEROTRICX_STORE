declare module 'cookie-parser' {
  import { RequestHandler } from 'express';
  export default function cookieParser(secret?: string | string[]): RequestHandler;
}
