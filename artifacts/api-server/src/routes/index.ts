import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import menuRouter from "./menu";
import occasionsRouter from "./occasions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(menuRouter);
router.use("/occasions", occasionsRouter);

export default router;
