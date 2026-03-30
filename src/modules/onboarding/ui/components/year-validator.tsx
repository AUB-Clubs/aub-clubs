"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { shouldNudgeYearChange } from "../../lib/validations";

interface YearValidatorProps {
  dob: Date;
  selectedYear: number;
}

export function YearValidator({ dob, selectedYear }: YearValidatorProps) {
  const { shouldNudge, suggestedYear } = shouldNudgeYearChange(dob, selectedYear);

  if (!shouldNudge) {
    return null;
  }

  const yearNames: Record<number, string> = {
    1: "Freshman",
    2: "Sophomore",
    3: "Junior",
    4: "Senior",
  };

  return (
    <Alert variant="default" className="mt-2 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
        Based on your date of birth, you might be in year {suggestedYear} ({yearNames[suggestedYear]}). 
        Please verify your selection is correct.
      </AlertDescription>
    </Alert>
  );
}
