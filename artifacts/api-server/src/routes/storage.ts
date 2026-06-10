import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { z } from "zod/v4";
import { db, missionLogsTable, missionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

const RequestUploadUrlBody = z.object({
  contentType: z
    .string()
    .regex(/^image\//i, "이미지 파일만 올릴 수 있어요.")
    .max(100),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, "사진은 10MB 이하만 올릴 수 있어요."),
});

/**
 * POST /api/storage/uploads/request-url
 *
 * A logged-in child requests a presigned PUT URL to upload a mission proof
 * photo. The client sends JSON metadata only (contentType, size) — never the
 * file — then PUTs the bytes directly to the returned `uploadURL`. The returned
 * `objectPath` ("/objects/...") is what gets stored in mission_logs.photoUrl.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!req.session?.childId) {
    res.status(401).json({ error: "아이 로그인이 필요해요." });
    return;
  }
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요." });
    return;
  }
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "사진 업로드 주소 생성에 실패했어요." });
  }
});

/**
 * GET /api/storage/objects/*path
 *
 * Serve a mission proof photo. Authorization is by ownership rather than an ACL
 * framework: the requested objectPath must be referenced by a mission_logs row,
 * and the requester must be that log's child (owner), the mission's parent, or
 * an admin. A just-uploaded-but-not-yet-submitted object has no log row and is
 * therefore intentionally inaccessible here — the child previews it via a local
 * blob URL before submitting, so no serving is needed pre-submit.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const [row] = await db
      .select({
        childId: missionLogsTable.childId,
        parentId: missionsTable.parentId,
      })
      .from(missionLogsTable)
      .innerJoin(missionsTable, eq(missionLogsTable.missionId, missionsTable.id))
      .where(eq(missionLogsTable.photoUrl, objectPath))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "사진을 찾을 수 없어요." });
      return;
    }

    const isOwnerChild = req.session?.childId === row.childId;
    const isParent = req.session?.parentId === row.parentId;
    const isAdmin = req.session?.isAdmin === true;
    if (!isOwnerChild && !isParent && !isAdmin) {
      res.status(403).json({ error: "권한이 없어요." });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    // presigned PUT 서명에 contentType이 강제되지 않으므로(서명 조건 미포함),
    // 서빙 시점에 이미지가 아니면 차단하고 sniffing을 막아 stored-XSS를 방지한다.
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^image\//i.test(contentType)) {
      res.status(415).json({ error: "이미지 파일이 아니에요." });
      return;
    }

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-type") return;
      res.setHeader(key, value);
    });
    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "사진을 찾을 수 없어요." });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "사진을 불러오지 못했어요." });
  }
});

export default router;
