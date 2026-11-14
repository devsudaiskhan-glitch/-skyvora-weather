export function notFound(_req, res) {
  res
    .status(404)
    .json({ success: false, message: "The requested resource was not found." });
}

export function errorHandler(error, req, res, _next) {
  // Error objects may originate from Fetch/DOMException and need not have a
  // normal writable message property. Read defensively and never mutate them.
  const statusCandidate = Number(error?.statusCode);
  const status =
    Number.isInteger(statusCandidate) &&
    statusCandidate >= 400 &&
    statusCandidate <= 599
      ? statusCandidate
      : 500;
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "An unexpected server error occurred.";
  if (status >= 500)
    console.error("[api-error]", req.method, req.originalUrl, message);
  else if (status >= 400 && process.env.NODE_ENV !== "production")
    console.warn("[api-validation]", req.method, req.originalUrl, message);
  const publicMessage =
    status >= 500
      ? status === 503
        ? "The weather service is temporarily unreachable. Check your internet connection and try again."
        : "The request could not be completed. Please try again."
      : message;
  res.status(status).json({ success: false, message: publicMessage });
}
