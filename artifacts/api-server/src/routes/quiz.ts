import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { z } from "zod";

const router = Router();

const GenerateQuizBody = z.object({
  passage: z.string().min(1),
  bookName: z.string().min(1),
});

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

router.post("/quiz/generate", async (req, res) => {
  const parsed = GenerateQuizBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "passage와 bookName이 필요합니다." });
    return;
  }

  const { passage, bookName } = parsed.data;

  const prompt = `당신은 초등학생(7-10세) 아이들을 위한 성경 교육 전문가입니다.
아이가 방금 "${passage}"(${bookName})를 읽었습니다.

다음 규칙에 따라 해당 성경 구절에 관한 퀴즈 2개를 만들어주세요:
- 7-10세 아이가 이해할 수 있는 쉽고 재미있는 문장으로 작성
- 각 문제는 4개의 선택지(객관식)로 구성
- 정답은 반드시 명확하게 1개만 존재
- 성경 내용에 충실하되, 너무 어렵지 않게

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "questions": [
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctIndex": 0
    },
    {
      "question": "문제 내용",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "correctIndex": 2
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      req.log.error({ content }, "OpenAI returned no valid JSON");
      res.status(500).json({ error: "퀴즈 생성에 실패했습니다." });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as { questions: QuizQuestion[] };
    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Quiz generation failed");
    res.status(500).json({ error: "퀴즈 생성 중 오류가 발생했습니다." });
  }
});

export default router;
