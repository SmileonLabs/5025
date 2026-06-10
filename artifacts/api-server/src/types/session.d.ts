import "express-session";

declare module "express-session" {
  interface SessionData {
    parentId?: number;
    childId?: number;
    isAdmin?: boolean;
  }
}
