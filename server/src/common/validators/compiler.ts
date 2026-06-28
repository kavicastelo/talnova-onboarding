import { FastifyInstance } from "fastify";
import { ZodType } from "zod";

export function setupZodValidation(app: FastifyInstance) {
  app.setValidatorCompiler(({ schema }) => {
    return (data: any) => {
      if (schema instanceof ZodType) {
        const result = schema.safeParse(data);
        if (result.success) {
          return { value: result.data };
        }
        return { error: result.error };
      }
      // If it's not a Zod type, return as-is or handle standard Ajv if needed
      return { value: data };
    };
  });
}

export default setupZodValidation;
