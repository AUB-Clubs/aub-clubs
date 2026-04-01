"use client";

import { useFormContext, useWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { YearValidator } from "./year-validator";
import type { OnboardingInput } from "../../lib/validations";

export function AcademicInfoStep() {
  const form = useFormContext<OnboardingInput>();
  const dob = useWatch({ control: form.control, name: "dob" });

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="aubnetId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>AUB ID (AUBnet ID)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="e.g., 202312345"
                {...field}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value ? parseInt(value, 10) : undefined);
                }}
                value={field.value || ""}
              />
            </FormControl>
            <FormDescription>
              Your unique AUB student ID number
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="major"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Major</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Computer Science" {...field} />
            </FormControl>
            <FormDescription>
              Your primary field of study
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="year"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Year</FormLabel>
            <Select
              onValueChange={(value) => field.onChange(parseInt(value, 10))}
              value={field.value?.toString()}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select your year" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="0">Freshman (Year 0)</SelectItem>
                <SelectItem value="1">Sophomore (Year 1)</SelectItem>
                <SelectItem value="2">Junior (Year 2)</SelectItem>
                <SelectItem value="3">Senior (Year 3)</SelectItem>
                <SelectItem value="4">4th Year or above (Year 4+)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
            {dob && field.value && (
              <YearValidator dob={dob} selectedYear={field.value} />
            )}
          </FormItem>
        )}
      />
    </div>
  );
}
