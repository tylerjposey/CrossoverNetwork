export function hasUsefulInput(text: string): boolean {
  const input = text.trim();
  if (input.length < 20) return false;
  const letters = input.match(/\p{L}/gu) ?? [];
  if (letters.length < 12 || /(\p{L})\1{7,}/u.test(input)) return false;
  const words = input.toLowerCase().match(/\p{L}+/gu) ?? [];
  const latin = words.filter((w) => /^[a-z]{4,}$/.test(w));
  const nonsense = latin.filter((w) => !/[aeiouy]/.test(w) || /(?:asdf|qwer|zxcv|hjkl|qazwsx)/.test(w));
  if (latin.length && nonsense.length / latin.length > 0.45) return false;
  // Broad clues, not a school/major allowlist: unusual fields and interests work.
  return /\b(stud(?:y|ying|ies|ent)|school|college|university|major|degree|graduat\w*|career|work\w*|job|profession\w*|experience|field|research|learn\w*|teach\w*|nurs\w*|engineer\w*|design\w*|develop\w*|creat\w*|build\w*|business|finance|market\w*|art|science|goal\w*|hope\w*|want|plan\w*|aspir\w*|dream\w*|interest\w*|hobb\w*|enjoy|love|passion\w*|into|play\w*|read\w*|run\w*|hik\w*|climb\w*|cook\w*|music|sport\w*|volunteer\w*)\b/i.test(input)
    || /学习|大学|工作|兴趣|职业|研究|学生|仕事|趣味|勉強|estudio|trabajo|intereses|estudante|trabalho|étudie|travail|intérêt|studieren|beruf|hobby/i.test(input);
}

export function taggedData(tag: string, value: unknown): string {
  return `<${tag}>\n${JSON.stringify(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}\n</${tag}>`;
}
