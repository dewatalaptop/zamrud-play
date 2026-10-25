import { RequestHandler } from "express";

// Express doesn't catch a rejected Promise from an async handler on its
// own — wrap every async route with this so a thrown error reaches
// errorHandler.ts instead of hanging the request.
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
