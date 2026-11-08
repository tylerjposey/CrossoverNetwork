import { Router, type IRouter } from "express";
import healthRouter from "./health";
import crossoverRouter from "./crossover";

const router: IRouter = Router();

router.use(healthRouter);
router.use(crossoverRouter);

export default router;
