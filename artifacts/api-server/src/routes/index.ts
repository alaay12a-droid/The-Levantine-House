import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import menuRouter from "./menu";
import occasionsRouter from "./occasions";
import storageRouter from "./storage";
import pushTokensRouter from "./push-tokens";
import bannersRouter from "./banners";
import revenueRouter from "./revenue";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(menuRouter);
router.use("/occasions", occasionsRouter);
router.use(storageRouter);
router.use(pushTokensRouter);
router.use(bannersRouter);
router.use(revenueRouter);

export default router;
