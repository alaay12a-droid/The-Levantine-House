import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import menuRouter from "./menu";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(menuRouter);

export default router;
