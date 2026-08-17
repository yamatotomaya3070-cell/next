import { geminiProvider } from "./gemini";
import { mockProvider } from "./mock";
import type {
  AiProvider,
  GenerateCaseGuideInput,
  GeneratedCaseGuide,
  GeneratePracticeScriptInput,
  GeneratedPracticeScriptResult,
  GenerateSimilarCaseInput,
  GenerateSourceScriptInput,
  GeneratedSimilarCase,
  GeneratedSourceScript,
  GenerateTaskInput,
  GeneratedTask,
  GradeResult,
  GradeSubmissionInput,
  ProposeStyleGuidesInput,
  StyleGuideProposal,
} from "./types";

export type * from "./types";

function activeProvider(): AiProvider {
  return process.env.GEMINI_API_KEY ? geminiProvider : mockProvider;
}

/** スタイルガイド案の提案。Gemini 失敗時はモック（プリセット）にフォールバックする */
export async function proposeStyleGuides(
  input: ProposeStyleGuidesInput,
): Promise<StyleGuideProposal & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.proposeStyleGuides(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini スタイルガイド提案に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.proposeStyleGuides(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

/** 教材生成。Gemini 失敗時はモックにフォールバックし、provider 名で判別可能にする */
export async function generateTask(
  input: GenerateTaskInput,
): Promise<GeneratedTask & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.generateTask(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini 教材生成に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.generateTask(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

/**
 * 実案件テキスト→類似模擬案件の生成。
 * 注意: フォールバック時は簡易マスキングになるため、maskingReport の
 * riskNotes を職員承認画面で必ず表示すること。
 */
export async function generateSimilarCase(
  input: GenerateSimilarCaseInput,
): Promise<GeneratedSimilarCase & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.generateSimilarCase(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini 模擬案件生成に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.generateSimilarCase(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

/**
 * 実案件の配布用ガイド生成（CrowdWorks案件）。案件内容は変えず、就労者向けの
 * 読みやすい依頼書＋手順書＋チェックリストを用意する。Gemini 失敗時はモックにフォールバック。
 */
export async function generateCaseGuide(
  input: GenerateCaseGuideInput,
): Promise<GeneratedCaseGuide & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.generateCaseGuide(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini ガイド生成に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.generateCaseGuide(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

/** 素材動画の台本生成。Gemini 失敗時はモックにフォールバック */
export async function generateSourceScript(
  input: GenerateSourceScriptInput,
): Promise<GeneratedSourceScript & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.generateSourceScript(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini 台本生成に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.generateSourceScript(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

/**
 * 練習用素材台本の生成（Stage2）。priority(must/optional)付きのバラバラ素材台本。
 * Gemini 失敗時はモック（決定的なバランス済み台本）にフォールバック。
 */
export async function generatePracticeScript(
  input: GeneratePracticeScriptInput,
): Promise<GeneratedPracticeScriptResult & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.generatePracticeScript(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini 練習台本生成に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.generatePracticeScript(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}

/** 提出物採点。Gemini 失敗時はモックにフォールバック */
export async function gradeSubmission(
  input: GradeSubmissionInput,
): Promise<GradeResult & { provider: string }> {
  const provider = activeProvider();
  try {
    const result = await provider.gradeSubmission(input);
    return { ...result, provider: provider.name };
  } catch (err) {
    if (provider.name === "gemini") {
      console.error("Gemini 採点に失敗。モックにフォールバックします:", err);
      const result = await mockProvider.gradeSubmission(input);
      return { ...result, provider: "mock(fallback)" };
    }
    throw err;
  }
}
