import fs from "fs";
import path from "path";

const PROMPT_TEMPLATE = fs.readFileSync(
  path.join(process.cwd(), "prompt.md"),
  "utf8"
);

export function getMainAgentPrompt(context: {
  clubName: string;
  clubDescription: string;
  memberSize: number;
  date: string;
  time: string;
}): string {
  return PROMPT_TEMPLATE
    .replace("[INJECT_CLUB_NAME]", context.clubName)
    .replace("[INJECT_CLUB_DESC]", context.clubDescription)
    .replace("[INJECT_MEMBER_SIZE]", context.memberSize.toString())
    .replace("[INJECT_DATE]", context.date)
    .replace("[INJECT_TIME]", context.time);
}
