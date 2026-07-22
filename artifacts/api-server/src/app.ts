import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

const dashboardDist = path.resolve(__dirname, "../../dashboard/dist/public");
app.use("/dashboard", express.static(dashboardDist));
app.get(["/dashboard", "/dashboard/", "/dashboard/*splat"], (_req, res) => {
  res.sendFile(path.join(dashboardDist, "index.html"));
});

// JSON error handler — must have 4 params for Express to treat it as error middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, method: req.method, url: req.url }, "Unhandled error");
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;
