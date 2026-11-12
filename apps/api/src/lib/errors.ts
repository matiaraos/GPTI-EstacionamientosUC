import type { ErrorRequestHandler, RequestHandler } from "express";

export type ErrorDetails = Record<string, string>;

/** Error con respuesta pública. `code` es estable para los clientes y `message` está en español. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetails,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, "ruta_no_encontrada", "La ruta solicitada no existe."));
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, ...(error.details && { details: error.details }) },
    });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    response.status(400).json({ error: { code: "json_invalido", message: "El cuerpo de la solicitud no es JSON válido." } });
    return;
  }
  console.error(error);
  response.status(500).json({ error: { code: "error_interno", message: "Ocurrió un error inesperado." } });
};
