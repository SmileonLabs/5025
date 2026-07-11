import { Router, type IRouter } from "express";
import healthRouter from "./health";
import quizRouter from "./quiz";
import authRouter from "./auth";
import childrenRouter from "./children";
import transactionsRouter from "./transactions";
import missionsRouter from "./missions";
import requestsRouter from "./requests";
import pushRouter from "./push";
import topupsRouter from "./topups";
import gifticonsRouter from "./gifticons";
import adminRouter from "./admin";
import storageRouter from "./storage";
import readingRouter from "./reading";
import booksRouter from "./books";

const router: IRouter = Router();

router.use(healthRouter);
router.use(quizRouter);
router.use(authRouter);
router.use(childrenRouter);
router.use(transactionsRouter);
router.use(missionsRouter);
router.use(requestsRouter);
router.use(pushRouter);
router.use(topupsRouter);
router.use(gifticonsRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(readingRouter);
router.use(booksRouter);

export default router;
