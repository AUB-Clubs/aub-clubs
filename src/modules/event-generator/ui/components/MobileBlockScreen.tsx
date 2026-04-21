"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Monitor, Sparkles } from "lucide-react";

/**
 * MobileBlockScreen
 * Displays when Event Generator is accessed from mobile/tablet devices.
 * The two-pane interface requires desktop screen size.
 */
export default function MobileBlockScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted/20">
      <Card className="max-w-md w-full border-red-200 dark:border-red-800">
        <CardContent className="pt-6 pb-8 px-6 space-y-6 text-center">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex size-20 items-center justify-center rounded-full bg-red-500/10">
                <Sparkles className="size-10 text-red-600 dark:text-red-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex size-10 items-center justify-center rounded-full bg-background border-2 border-red-200 dark:border-red-800">
                <Monitor className="size-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Desktop Required
            </h2>
            <p className="text-sm text-muted-foreground">
              The Event Generator AI assistant requires a desktop or laptop computer for the best experience.
            </p>
          </div>

          {/* Explanation */}
          <div className="space-y-3 text-left bg-muted/50 rounded-lg p-4">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Why desktop only?</strong>
            </p>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
              <li>Two-pane interface (chat + event preview)</li>
              <li>Complex forms and data visualization</li>
              <li>Real-time AI streaming requires larger screen</li>
            </ul>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground">
            Please visit this page from a desktop or laptop to use the Event Generator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
