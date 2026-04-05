import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (
  schema: ZodSchema,
  part: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      res.status(400).json({ success: false, message: 'Validation failed', errors });
      return;
    }
    (req as Record<string, unknown>)[part] = result.data;
    next();
  };
};
