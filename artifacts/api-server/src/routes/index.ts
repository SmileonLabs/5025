import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizRouter from "./quiz";
import authRouter from "./auth";
import childrenRouter from "./children";
import transactionsRouter from "./transactions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quizRouter);
router.use(authRouter);
router.use(childrenRouter);
router.use(transactionsRouter);

export default router;
