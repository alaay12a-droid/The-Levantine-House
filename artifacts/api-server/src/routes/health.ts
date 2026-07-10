import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Render sets RENDER_GIT_COMMIT automatically on every deploy — lets us verify
// which commit is actually live without needing Render API access.
router.get("/version", (_req, res) => {
  res.json({
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    deployedAt: process.env.RENDER_GIT_COMMIT ? undefined : "local/dev (no RENDER_GIT_COMMIT set)",
  });
});

export default router;
